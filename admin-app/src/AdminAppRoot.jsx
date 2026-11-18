import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { auth } from '../../src/firebase/firebase.js'
import { closeTopOverlay } from '../../src/navigation/overlayBackStack.js'
import AdminPage from '../../src/pages/AdminPage.jsx'
import { getAdminCapabilities } from '../../src/admin/services/adminAuthService.js'

/**
 * Step 1 of the admin app: Firebase sign-in (email + password — Google
 * sign-in pop-ups don't work inside an Android WebView). The account must
 * be the owner account the device is enrolled under; the admin password
 * and device key are checked next (AdminLockScreen).
 */
const input =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 transition-colors duration-150'

function authMessage(err) {
  const code = err?.code || ''
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') return 'Email or password is incorrect.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes and try again.'
  if (code === 'auth/network-request-failed') return 'No connection. Check your internet and try again.'
  if (code === 'auth/user-disabled') return 'This account is disabled.'
  return 'Sign-in failed. Please try again.'
}

function FirebaseSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(authMessage(err))
      setPassword('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="min-h-dvh bg-[#f8fafc] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-7">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold">C</span>
          <p className="mt-3 text-[19px] font-bold tracking-tight text-gray-900">Campinity Admin</p>
          <p className="mt-1 text-sm text-gray-500">Sign in with the owner's Campinity account</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5 sm:p-6 space-y-3">
          <input type="email" inputMode="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" className={input} />
          <input type="password" autoComplete="current-password" placeholder="Campinity password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Campinity password" className={input} />
          {error && (
            <p className="text-[13px] text-red-600" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 text-white text-[15px] font-semibold py-3 hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-gray-500">Private administration app. Access also requires an authorized device and the admin password.</p>
      </div>
    </div>
  )
}

function BackendGate({ state, onRetry }) {
  return (
    <div className="min-h-dvh bg-[#f8fafc] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-7">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold">C</span>
          <p className="mt-3 text-[19px] font-bold tracking-tight text-gray-900">Campinity Admin</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5 sm:p-6">
          {state === 'checking' ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-900">{state === 'offline' ? "Couldn't reach Campinity" : 'Admin backend not updated yet'}</p>
              <p className="mt-1 text-sm text-gray-500">
                {state === 'offline'
                  ? 'Check your internet connection and try again.'
                  : 'This app needs the device-secured admin Cloud Functions (API v2). Until they are deployed, sign-in stays disabled so nothing runs against the old backend.'}
              </p>
              <button type="button" onClick={onRetry} className="mt-5 w-full rounded-xl bg-blue-600 text-white text-[15px] font-semibold py-3 hover:bg-blue-700">
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminAppRoot() {
  const [user, setUser] = useState(undefined)
  // Check the backend BEFORE asking for any credentials (read-only version probe).
  const [backend, setBackend] = useState('checking') // checking | ok | outdated | offline
  const checkBackend = () => {
    setBackend('checking')
    getAdminCapabilities()
      .then(() => setBackend('ok'))
      .catch((err) => setBackend(!navigator.onLine || err?.code === 'functions/unavailable' || /network|failed to fetch/i.test(err?.message || '') ? 'offline' : 'outdated'))
  }
  useEffect(checkBackend, [])
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        // Signing out of Firebase also drops any stored admin session.
        if (!u) {
          try {
            localStorage.removeItem('campinity-admin:session')
          } catch {}
        }
        setUser(u || null)
      }),
    []
  )

  // Android back: close the top sheet/dialog first, otherwise leave the app (never navigates to anything public).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    const handle = CapApp.addListener('backButton', () => {
      if (!closeTopOverlay()) CapApp.minimizeApp()
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  if (backend !== 'ok') return <BackendGate state={backend} onRetry={checkBackend} />
  if (user === undefined) {
    return (
      <div className="min-h-dvh bg-[#f8fafc] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
      </div>
    )
  }
  if (!user) return <FirebaseSignIn />
  return <AdminPage onSignOut={() => signOut(auth)} accountLabel={user.email || 'Signed in'} />
}
