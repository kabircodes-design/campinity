import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock3, Loader2, MailCheck, ShieldAlert, TriangleAlert, XCircle } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import { auth } from '../../firebase/firebase.js'
import { resolveOnboardingRoute } from '../components/ProtectedRoute.jsx'
import { getUserProfile } from '../utils/userProfile.js'
import { resendEmailVerification, verifyEmailVerificationToken } from '../../firebase/emailVerificationService.js'
import { getAuthErrorMessage, logAuthErrorForDebug } from '../utils/authErrorMessages.js'

/**
 * Content for each state of the token-verification flow (a click from
 * the emailed link, ?token=... in the URL). Kept separate from the
 * "waiting for verification" view below (no token — the screen shown
 * right after signup, with Resend / I've verified).
 */
const TOKEN_STATE_CONTENT = {
  verifying: {
    icon: Loader2,
    iconClassName: 'text-accent animate-spin',
    title: 'Verifying your email',
    subtitle: 'Just a moment…'
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-emerald-500',
    title: 'Email verified 🎉',
    subtitle: "You're all set — let's get you into Campinity."
  },
  invalid: {
    icon: XCircle,
    iconClassName: 'text-red-500',
    title: 'Invalid verification link',
    subtitle: 'This link is broken or was never valid. Request a new one below.'
  },
  expired: {
    icon: Clock3,
    iconClassName: 'text-amber-500',
    title: 'This link has expired',
    subtitle: 'Verification links only last 20 minutes. Request a new one below.'
  },
  'already-used': {
    icon: ShieldAlert,
    iconClassName: 'text-amber-500',
    title: 'Link already used',
    subtitle: 'This verification link has already been used. If you already verified, log in to continue.'
  },
  'server-error': {
    icon: TriangleAlert,
    iconClassName: 'text-red-500',
    title: 'Something went wrong',
    subtitle: "We couldn't verify your email right now. Please try again shortly."
  }
}

function TokenVerificationView({ token }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying')

  useEffect(() => {
    let cancelled = false

    verifyEmailVerificationToken(token)
      .then(async () => {
        // Refresh the local session's emailVerified flag if this browser
        // happens to be signed in as the account that was just verified
        // (the common case — verifying from the same device as signup).
        if (auth.currentUser) {
          await auth.currentUser.reload().catch(() => {})
        }
        if (!cancelled) setStatus('success')
      })
      .catch(async (err) => {
        logAuthErrorForDebug('VerifyEmailPage.verifyToken', err)
        const reason = err?.details?.reason

        if (reason === 'already-used' && auth.currentUser) {
          // "already-used" alone never proves THIS browser's session is
          // verified (Task 13) — it could be a stale double-submit of a
          // link this same session already redeemed, or a genuinely
          // reused/replayed token. Only a fresh reload confirming
          // emailVerified is treated as success; otherwise we fall
          // through to the non-continuable already-used state below.
          await auth.currentUser.reload().catch(() => {})
          if (!cancelled) setStatus(auth.currentUser.emailVerified ? 'success' : 'already-used')
          return
        }

        if (!cancelled) setStatus(TOKEN_STATE_CONTENT[reason] ? reason : 'server-error')
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const handleContinue = async () => {
    if (!auth.currentUser) {
      navigate('/login')
      return
    }
    const profile = await getUserProfile(auth.currentUser.uid)
    navigate(resolveOnboardingRoute(profile))
  }

  const { icon: StatusIcon, iconClassName, title, subtitle } = TOKEN_STATE_CONTENT[status]
  const isTerminal = status !== 'verifying'

  return (
    <AuthLayout eyebrow="One last step" title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-tint flex items-center justify-center">
          <StatusIcon className={`w-8 h-8 ${iconClassName}`} strokeWidth={1.6} />
        </div>

        {isTerminal && (
          <div className="mt-7 w-full space-y-3">
            {status === 'success' ? (
              <Button onClick={handleContinue}>Continue to Campinity</Button>
            ) : status === 'already-used' ? (
              <Button onClick={() => navigate('/login')}>Go to login</Button>
            ) : (
              <Button onClick={() => navigate('/verify-email')}>Request a new link</Button>
            )}
          </div>
        )}
      </div>
    </AuthLayout>
  )
}

function WaitingView() {
  const navigate = useNavigate()
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [error, setError] = useState('')

  const email = auth.currentUser?.email

  const handleResend = async () => {
    if (!auth.currentUser || resending) return
    setResending(true)
    setError('')
    setResendMessage('')
    try {
      const result = await resendEmailVerification()
      setResendMessage(
        result?.alreadyVerified
          ? "Your email is already verified — tap \"I've verified\" to continue."
          : 'Verification email sent — check your inbox.'
      )
    } catch (err) {
      logAuthErrorForDebug('VerifyEmailPage.resend', err)
      setError(getAuthErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  const handleCheckVerified = async () => {
    if (!auth.currentUser || checking) return
    setChecking(true)
    setError('')
    try {
      await auth.currentUser.reload()
      if (auth.currentUser.emailVerified) {
        const profile = await getUserProfile(auth.currentUser.uid)
        navigate(resolveOnboardingRoute(profile))
      } else {
        setError("Still not verified — open the link in the email we sent, then try again.")
      }
    } catch (err) {
      logAuthErrorForDebug('VerifyEmailPage.checkVerified', err)
      setError(getAuthErrorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="One last step"
      title="Verify your email"
      subtitle={
        email
          ? `We've sent a verification email to ${email}.`
          : "We've sent a verification email to your inbox."
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-tint flex items-center justify-center">
          <MailCheck className="w-8 h-8 text-accent" strokeWidth={1.6} />
        </div>

        {resendMessage && (
          <p
            role="status"
            className="mt-5 w-full rounded-xl2 bg-accent-tint text-accent text-[13px] font-medium px-4 py-3"
          >
            {resendMessage}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 w-full rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3"
          >
            {error}
          </p>
        )}

        <div className="mt-7 w-full space-y-3">
          <Button onClick={handleCheckVerified} loading={checking} disabled={resending}>
            I've verified
          </Button>
          <Button variant="secondary" onClick={handleResend} loading={resending} disabled={checking}>
            Resend email
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  if (token) {
    return <TokenVerificationView token={token} />
  }

  return <WaitingView />
}
