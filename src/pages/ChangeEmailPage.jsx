import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmailAuthProvider, reauthenticateWithCredential, signOut, verifyBeforeUpdateEmail } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { BadgeCheck, MailWarning } from 'lucide-react'
import SettingsPageShell, { Notice, SectionLabel, fieldCls, primaryBtn } from '../components/settings/SettingsPageShell.jsx'
import { auth, db } from '../firebase/firebase.js'

/**
 * Change email — Firebase Auth's secure flow:
 *  1. re-authenticate with the current password,
 *  2. verifyBeforeUpdateEmail(): Firebase emails a link to the NEW address,
 *  3. the account email changes only when that link is opened.
 * Until then the current email stays active. Nothing here writes the email
 * itself; the app only re-reads Firebase's state (reload) and, once Firebase
 * reports the new verified email, syncs the legacy users/{uid}.email field —
 * which Firestore rules accept only if it equals the caller's verified token email.
 *
 * Independent of signup verification (emailVerificationService): it never
 * calls the dormant Resend flow.
 */
const PENDING_KEY = (uid) => `campinity:pendingEmailChange:${uid}`
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function readPending(uid) {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY(uid)) || 'null')
  } catch {
    return null
  }
}
function writePending(uid, v) {
  try {
    if (v) localStorage.setItem(PENDING_KEY(uid), JSON.stringify(v))
    else localStorage.removeItem(PENDING_KEY(uid))
  } catch {}
}

export function emailChangeErrorMessage(err) {
  switch (err?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Your current password is incorrect.'
    case 'auth/email-already-in-use':
      return 'Another account already uses that email.'
    case 'auth/invalid-email':
    case 'auth/invalid-new-email':
      return 'Enter a valid email address.'
    case 'auth/requires-recent-login':
      return 'For your security, enter your current password again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'No connection. Check your internet and try again.'
    case 'auth/operation-not-allowed':
      return 'Email changes are not enabled for this app yet.'
    default:
      return 'Could not start the email change. Please try again.'
  }
}

export default function ChangeEmailPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = auth.currentUser
  const usesPassword = Boolean(user?.providerData?.some((p) => p.providerId === 'password'))
  const [currentEmail, setCurrentEmail] = useState(user?.email || '')
  const [verified, setVerified] = useState(Boolean(user?.emailVerified))
  const [pending, setPending] = useState(() => (user ? readPending(user.uid) : null))
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  /** Re-reads Firebase; completes the change once Firebase shows the new email. */
  const refresh = useCallback(async () => {
    const u = auth.currentUser
    if (!u) return
    try {
      await u.reload()
    } catch (err) {
      // Firebase ends existing sessions when the email changes on another device.
      if (['auth/user-token-expired', 'auth/user-disabled', 'auth/user-not-found', 'auth/invalid-user-token'].includes(err?.code)) {
        writePending(u.uid, null)
        await signOut(auth).catch(() => {})
        navigate('/login', { replace: true, state: { emailJustVerified: true } })
      }
      return
    }
    const fresh = auth.currentUser
    setCurrentEmail(fresh.email || '')
    setVerified(Boolean(fresh.emailVerified))
    const p = readPending(fresh.uid)
    if (p && fresh.email && fresh.email.toLowerCase() === p.email.toLowerCase()) {
      writePending(fresh.uid, null)
      setPending(null)
      await fresh.getIdToken(true).catch(() => {})
      // Keep the legacy profile email (if this account still has one) in step with Auth.
      try {
        const ref = doc(db, 'users', fresh.uid)
        const snap = await getDoc(ref)
        if (snap.exists() && typeof snap.data().email === 'string' && snap.data().email !== fresh.email) await updateDoc(ref, { email: fresh.email })
      } catch {}
      setNotice({ tone: 'success', text: `Your email is now ${fresh.email}.` })
    }
  }, [navigate])

  useEffect(() => {
    refresh()
    const onFocus = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh, params])

  const start = async (e, resendTo) => {
    e?.preventDefault()
    const u = auth.currentUser
    const target = (resendTo || newEmail).trim()
    if (!u) return
    if (!EMAIL_RE.test(target)) return setNotice({ tone: 'error', text: 'Enter a valid email address.' })
    if (target.toLowerCase() === (u.email || '').toLowerCase()) return setNotice({ tone: 'error', text: "That's already your email." })
    if (!password) return setNotice({ tone: 'error', text: 'Enter your current password to confirm it’s you.' })
    setBusy(true)
    setNotice(null)
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password))
      await verifyBeforeUpdateEmail(u, target, { url: `${window.location.origin}/settings/email?changed=1`, handleCodeInApp: false }).catch(async (err) => {
        if (['auth/unauthorized-continue-uri', 'auth/invalid-continue-uri'].includes(err?.code)) return verifyBeforeUpdateEmail(u, target)
        throw err
      })
      const p = { email: target, sentAt: Date.now() }
      writePending(u.uid, p)
      setPending(p)
      setNewEmail('')
      setPassword('')
      setNotice({ tone: 'info', text: `We sent a confirmation link to ${target}. Your email changes only after you open it — until then, keep using ${u.email}.` })
    } catch (err) {
      setNotice({ tone: 'error', text: emailChangeErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const cancelPending = () => {
    if (user) writePending(user.uid, null)
    setPending(null)
    setNotice({ tone: 'info', text: 'Cancelled here. If you open the old confirmation link later it may still change your email, so ignore it if you changed your mind.' })
  }

  return (
    <SettingsPageShell title="Email address" back="/settings/account">
      <SectionLabel>Current email</SectionLabel>
      <div className="mx-4 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-50 break-all">{currentEmail || '—'}</p>
        <p className={`mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold ${verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'}`}>
          {verified ? <BadgeCheck className="w-4 h-4" /> : <MailWarning className="w-4 h-4" />}
          {verified ? 'Verified' : 'Not verified'}
        </p>
        {!verified && (
          <button type="button" onClick={() => navigate('/verify-email')} className="mt-2 block text-[13px] font-semibold text-blue-600 dark:text-blue-400">
            Verify this email
          </button>
        )}
      </div>

      {pending && (
        <div className="mx-4 mt-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-4">
          <p className="text-[13.5px] font-semibold text-amber-800 dark:text-amber-200">Waiting for confirmation</p>
          <p className="mt-1 text-[13px] text-amber-800/90 dark:text-amber-200/90 break-all">
            Open the link sent to <strong>{pending.email}</strong>. Didn't get it, or it expired? Enter your password below and send it again.
          </p>
          <div className="mt-2 flex gap-4">
            <button type="button" onClick={refresh} className="text-[13px] font-semibold text-amber-900 dark:text-amber-100">
              I've confirmed it
            </button>
            <button type="button" onClick={cancelPending} className="text-[13px] font-semibold text-amber-900/70 dark:text-amber-100/70">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {usesPassword ? (
        <form noValidate onSubmit={(e) => start(e, pending && !newEmail ? pending.email : undefined)} className="px-4 pt-5 space-y-3">
          <label className="block">
            <span className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">New email</span>
            <input type="email" inputMode="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={pending ? pending.email : 'you@example.com'} className={fieldCls} />
          </label>
          <label className="block">
            <span className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Current password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} />
          </label>
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy ? 'Sending…' : pending && !newEmail ? 'Resend confirmation link' : 'Send confirmation link'}
          </button>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">After the change you may need to log in again with your new email on your other devices.</p>
        </form>
      ) : (
        <Notice tone="info">You sign in with Google, so your email is managed by your Google account and can't be changed here.</Notice>
      )}
    </SettingsPageShell>
  )
}
