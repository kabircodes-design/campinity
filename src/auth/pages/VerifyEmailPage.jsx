import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { CheckCircle2, Clock3, Inbox, Loader2, MailCheck, RefreshCw, ShieldAlert, TriangleAlert, WifiOff, XCircle } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import { auth } from '../../firebase/firebase.js'
import { resolveOnboardingRoute } from '../components/ProtectedRoute.jsx'
import { ensureUserDoc } from '../utils/userProfile.js'
import {
  EMAIL_VERIFICATION_PROVIDER,
  RESEND_COOLDOWN_SECONDS,
  applyFirebaseVerificationCode,
  sendVerificationEmail,
  verifyEmailVerificationToken
} from '../../firebase/emailVerificationService.js'
import { getAuthErrorMessage, logAuthErrorForDebug } from '../utils/authErrorMessages.js'

/**
 * /verify-email
 *  (no params)                   inbox screen: pending status, send/resend with cooldown
 *  ?verified=1                   return from Firebase's hosted page ("Continue")
 *  ?mode=verifyEmail&oobCode=…   in-app Firebase action link (if the Console action URL is ever pointed here)
 *  ?token=…                      custom (Resend) link — only when that provider is active
 *
 * Access is granted ONLY by Firebase Auth's own emailVerified flag, re-read
 * with reload(); this page never marks an account verified itself.
 */

const isNetworkError = (err) =>
  err?.code === 'auth/network-request-failed' ||
  (err?.code === 'functions/unavailable' && !err?.details?.reason) ||
  /network|failed to fetch|offline/i.test(err?.message || '') ||
  (typeof navigator !== 'undefined' && navigator.onLine === false)

async function routeAfterVerified(navigate) {
  const user = auth.currentUser
  if (!user) {
    navigate('/login', { replace: true, state: { emailJustVerified: true } })
    return
  }
  // Fresh ID token so anything reading the email_verified claim sees it right away.
  await user.getIdToken(true).catch(() => {})
  const profile = await ensureUserDoc(user).catch(() => null)
  navigate(resolveOnboardingRoute(profile), { replace: true })
}

/** Re-reads the signed-in user from Firebase. Returns true only if Firebase says verified. */
async function reloadAndCheck() {
  const u = auth.currentUser
  if (!u) return false
  await u.reload()
  return auth.currentUser?.emailVerified === true
}

// ------------------------------------------------------------ result screens
const RESULT_STATES = {
  verifying: { icon: Loader2, tone: 'text-accent animate-spin', bg: 'bg-accent-tint dark:bg-blue-500/15', title: 'Verifying your email…', subtitle: 'This only takes a moment.' },
  success: { icon: CheckCircle2, tone: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/15', title: 'Email verified', subtitle: "You're all set. Welcome to Campinity." },
  'verified-signed-out': { icon: CheckCircle2, tone: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/15', title: 'Verification complete', subtitle: 'If you confirmed your email on the previous page, log in to start using Campinity.' },
  'not-yet': { icon: Inbox, tone: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/15', title: 'Not verified yet', subtitle: "We couldn't confirm the verification yet. Open the link in the latest email, then try again." },
  expired: { icon: Clock3, tone: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/15', title: 'This link has expired', subtitle: 'Request a fresh verification email — it only takes a second.' },
  superseded: { icon: Inbox, tone: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/15', title: 'A newer email was sent', subtitle: 'This link was replaced by a more recent one. Open the latest verification email in your inbox.' },
  'already-used': { icon: ShieldAlert, tone: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/15', title: 'Link already used', subtitle: 'This link has already been used. If your email is verified, just log in to continue.' },
  invalid: { icon: XCircle, tone: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/15', title: "This link isn't valid", subtitle: 'It may be incomplete, already used, or from an older email. Request a new verification email.' },
  legacy: { icon: Inbox, tone: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/15', title: 'This link is from an older email', subtitle: 'Verification emails now come from Firebase. Request a new one and use the link in that email.' },
  offline: { icon: WifiOff, tone: 'text-gray-500', bg: 'bg-gray-100 dark:bg-white/10', title: "You're offline", subtitle: 'Check your internet connection, then try again.' },
  'server-error': { icon: TriangleAlert, tone: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/15', title: "We couldn't verify right now", subtitle: 'Something went wrong. Please try again in a moment.' }
}

function ResultScreen({ status, onRetry }) {
  const navigate = useNavigate()
  const [continuing, setContinuing] = useState(false)
  const s = RESULT_STATES[status]
  const Icon = s.icon
  const signedIn = Boolean(auth.currentUser)
  const requestNewLink = () => (signedIn ? navigate('/verify-email', { replace: true }) : navigate('/login', { state: { needsVerification: true } }))
  const goOn = async () => {
    setContinuing(true)
    await routeAfterVerified(navigate)
    setContinuing(false)
  }

  return (
    <AuthLayout eyebrow="Email verification" title={s.title} subtitle={s.subtitle}>
      <div className="flex flex-col items-center text-center" aria-live="polite">
        <div className={`w-16 h-16 rounded-2xl ${s.bg} flex items-center justify-center`}>
          <Icon className={`w-8 h-8 ${s.tone}`} strokeWidth={1.6} />
        </div>
        {status !== 'verifying' && (
          <div className="mt-7 w-full space-y-3">
            {status === 'success' && (
              <Button loading={continuing} onClick={goOn}>
                {signedIn ? 'Continue to Campinity' : 'Log in to continue'}
              </Button>
            )}
            {status === 'verified-signed-out' && <Button onClick={() => navigate('/login', { state: { emailJustVerified: true } })}>Log in</Button>}
            {status === 'already-used' && <Button onClick={() => navigate('/login')}>Go to log in</Button>}
            {['expired', 'invalid', 'superseded', 'legacy', 'not-yet'].includes(status) && (
              <>
                <Button onClick={requestNewLink}>{signedIn ? (status === 'not-yet' ? 'Back to verification' : 'Send a new link') : 'Log in to get a new link'}</Button>
                {!signedIn && <p className="text-[12.5px] text-gray-500 dark:text-gray-400">For your security, new links are sent only after you log in.</p>}
              </>
            )}
            {(status === 'offline' || status === 'server-error') && onRetry && (
              <Button icon={<RefreshCw className="w-4 h-4" />} onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  )
}

/** Run an async check that resolves to a status, with retry on offline/server-error. */
function useStatus(run, deps) {
  const [status, setStatus] = useState('verifying')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setStatus('verifying')
    run()
      .then((s) => !cancelled && setStatus(s))
      .catch((err) => {
        logAuthErrorForDebug('VerifyEmailPage', err)
        if (!cancelled) setStatus(isNetworkError(err) ? 'offline' : 'server-error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])
  return [status, () => setAttempt((n) => n + 1)]
}

/** Back from Firebase's hosted verification page (?verified=1). */
function FirebaseReturnView() {
  const [status, retry] = useStatus(async () => {
    if (!auth.currentUser) return 'verified-signed-out'
    return (await reloadAndCheck()) ? 'success' : 'not-yet'
  }, [])
  return <ResultScreen status={status} onRetry={retry} />
}

/** In-app Firebase action link (?mode=verifyEmail&oobCode=…). */
function FirebaseCodeView({ oobCode }) {
  const [status, retry] = useStatus(async () => {
    try {
      await applyFirebaseVerificationCode(oobCode)
    } catch (err) {
      if (err?.code === 'auth/expired-action-code') return 'expired'
      if (err?.code === 'auth/invalid-action-code') {
        // Already applied (double click / scanner)? A verified signed-in user is fine.
        if (auth.currentUser && (await reloadAndCheck().catch(() => false))) return 'success'
        return 'invalid'
      }
      if (err?.code === 'auth/user-disabled' || err?.code === 'auth/user-not-found') return 'invalid'
      throw err
    }
    if (auth.currentUser) await reloadAndCheck().catch(() => {})
    return 'success'
  }, [oobCode])
  return <ResultScreen status={status} onRetry={retry} />
}

/** Custom (Resend) token link. */
function CustomTokenView({ token }) {
  const [status, retry] = useStatus(async () => {
    try {
      await verifyEmailVerificationToken(token)
    } catch (err) {
      const reason = err?.details?.reason
      if (reason === 'already-used' && auth.currentUser) return (await reloadAndCheck().catch(() => false)) ? 'success' : 'already-used'
      if (RESULT_STATES[reason]) return reason
      throw err
    }
    try {
      window.history.replaceState(window.history.state, '', '/verify-email')
    } catch {}
    if (auth.currentUser) await reloadAndCheck().catch(() => {})
    return 'success'
  }, [token])
  return <ResultScreen status={status} onRetry={retry} />
}

// ------------------------------------------------------------ inbox screen
const COOLDOWN_KEY = (uid) => `campinity:verifyResendAt:${uid}`
const readCooldownEnd = (uid) => {
  try {
    return Number(sessionStorage.getItem(COOLDOWN_KEY(uid))) || 0
  } catch {
    return 0
  }
}
const writeCooldownEnd = (uid, ms) => {
  try {
    sessionStorage.setItem(COOLDOWN_KEY(uid), String(ms))
  } catch {}
}

function sendErrorMessage(err) {
  if (err?.code === 'auth/too-many-requests') return 'Too many emails requested for this account. Please wait a few minutes before trying again.'
  if (isNetworkError(err)) return 'No connection. Check your internet and try again.'
  return getAuthErrorMessage(err)
}

function WaitingView() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = auth.currentUser
  const uid = user?.uid
  const email = user?.email || ''
  // From SignupPage: true = sent, false = account created but the send failed, undefined = arrived from login / refresh.
  const arrivedState = location.state?.verificationSent
  const expiryNote = (mins) => (mins ? ` It expires in ${mins} minutes.` : '')

  const [notice, setNotice] = useState(() =>
    arrivedState === true
      ? { tone: 'info', text: `We sent a verification link to ${email}.${expiryNote(location.state?.expiresInMinutes)}` }
      : arrivedState === false
        ? { tone: 'error', text: "Your account was created, but we couldn't send the verification email yet. Tap “Resend email” to try again." }
        : null
  )
  const [sentThisVisit, setSentThisVisit] = useState(arrivedState === true)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [cooldownEnd, setCooldownEnd] = useState(() => {
    const stored = uid ? readCooldownEnd(uid) : 0
    const fromSignup = arrivedState === true ? Date.now() + (location.state?.resendAvailableInSeconds || RESEND_COOLDOWN_SECONDS) * 1000 : 0
    return Math.max(stored, fromSignup)
  })
  const navigatingRef = useRef(false)

  useEffect(() => {
    if (uid && cooldownEnd) writeCooldownEnd(uid, cooldownEnd)
  }, [uid, cooldownEnd])
  useEffect(() => {
    if (cooldownEnd <= Date.now()) return undefined
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [cooldownEnd])
  // Recover a signup whose profile document couldn't be created (partial failure).
  useEffect(() => {
    if (user) ensureUserDoc(user).catch(() => {})
  }, [user])

  const checkVerified = useCallback(
    async ({ silent = false } = {}) => {
      if (!auth.currentUser || navigatingRef.current) return
      if (!silent) setChecking(true)
      try {
        if (await reloadAndCheck()) {
          navigatingRef.current = true
          await routeAfterVerified(navigate)
        } else if (!silent) {
          setNotice({ tone: 'warn', text: 'Not verified yet. Open the link in the email we sent, then come back here.' })
        }
      } catch (err) {
        if (!silent) {
          logAuthErrorForDebug('VerifyEmailPage.checkVerified', err)
          setNotice({ tone: 'error', text: sendErrorMessage(err) })
        }
      } finally {
        if (!silent) setChecking(false)
      }
    },
    [navigate]
  )

  // Already verified (e.g. on another device)? Never leave them on a pending screen.
  useEffect(() => {
    checkVerified({ silent: true })
  }, [checkVerified])
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && checkVerified({ silent: true })
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [checkVerified])

  const secondsLeft = Math.max(0, Math.ceil((cooldownEnd - now) / 1000))

  const handleSend = async () => {
    if (!auth.currentUser || sending || secondsLeft > 0) return
    setSending(true)
    setNotice(null)
    try {
      const result = await sendVerificationEmail(auth.currentUser)
      if (result?.alreadyVerified) {
        await checkVerified({ silent: true })
        return
      }
      setSentThisVisit(true)
      setNotice({
        tone: 'success',
        text: `Verification email sent to ${email}.${expiryNote(result?.expiresInMinutes)} Only the newest email's link is guaranteed to work.`
      })
      setCooldownEnd(Date.now() + (result?.resendAvailableInSeconds || RESEND_COOLDOWN_SECONDS) * 1000)
      setNow(Date.now())
      if (arrivedState !== undefined) navigate(location.pathname, { replace: true, state: null })
    } catch (err) {
      logAuthErrorForDebug('VerifyEmailPage.send', err)
      const retry = err?.details?.retryAfterSeconds || (err?.code === 'auth/too-many-requests' ? 300 : 0)
      if (retry) {
        setCooldownEnd(Date.now() + retry * 1000)
        setNow(Date.now())
      }
      setNotice({ tone: 'error', text: sendErrorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  const switchEmail = async () => {
    try {
      if (uid) sessionStorage.removeItem(COOLDOWN_KEY(uid))
    } catch {}
    await signOut(auth).catch(() => {})
    navigate('/signup', { replace: true })
  }

  const noticeClass = {
    info: 'bg-accent-tint dark:bg-blue-500/15 text-accent',
    success: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    warn: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300',
    error: 'bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400'
  }
  const sendLabel = sentThisVisit || arrivedState === false ? 'Resend email' : 'Send verification email'

  return (
    <AuthLayout
      eyebrow="One last step"
      title="Verify your email"
      subtitle="Open the link we email you to activate your Campinity account."
      footer={
        <>
          Wrong address?{' '}
          <button type="button" onClick={switchEmail} className="font-semibold text-accent hover:text-accent-deep transition-colors duration-200">
            Use a different email
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-tint dark:bg-blue-500/15 flex items-center justify-center">
          <MailCheck className="w-8 h-8 text-accent" strokeWidth={1.6} />
        </div>

        <div className="mt-5 w-full rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Verifying</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" /> Pending
            </span>
          </div>
          <p className="mt-1 text-[15px] font-semibold text-gray-900 dark:text-gray-50 break-all">{email || 'your email address'}</p>
        </div>

        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-4 w-full rounded-xl2 text-[13px] font-medium px-4 py-3 text-left ${noticeClass[notice.tone]}`}>
            {notice.text}
          </p>
        )}

        <div className="mt-6 w-full space-y-3">
          <Button onClick={() => checkVerified()} loading={checking} disabled={sending}>
            I've verified my email
          </Button>
          <Button variant="secondary" onClick={handleSend} loading={sending} disabled={checking || secondsLeft > 0}>
            {secondsLeft > 0 ? `${sendLabel} in ${secondsLeft}s` : sendLabel}
          </Button>
        </div>

        <ul className="mt-6 w-full space-y-1.5 text-left text-[12.5px] text-gray-500 dark:text-gray-400">
          <li>• Can't find it? Check your spam, junk or promotions folder.</li>
          {EMAIL_VERIFICATION_PROVIDER === 'firebase' && <li>• It comes from noreply@campinity-app.firebaseapp.com.</li>}
          <li>• The link works on any device — then come back here.</li>
        </ul>
      </div>
    </AuthLayout>
  )
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const oobCode = searchParams.get('oobCode')
  const mode = searchParams.get('mode')

  if (oobCode && (!mode || mode === 'verifyEmail')) return <FirebaseCodeView oobCode={oobCode} />
  if (searchParams.get('verified') === '1') return <FirebaseReturnView />
  if (token) {
    if (EMAIL_VERIFICATION_PROVIDER === 'custom') return <CustomTokenView token={token} />
    return <ResultScreen status="legacy" />
  }
  return <WaitingView />
}
