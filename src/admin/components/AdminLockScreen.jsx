import { useEffect, useState } from 'react'
import { checkAdminPasswordExists, setAdminPassword, adminLogin } from '../services/adminAuthService.js'
import { useAdminSession } from '../hooks/useAdminSession.jsx'

/**
 * REBUILT for the new architecture. Reachable by ANY authenticated
 * Campinity user now (App.jsx's /admin route is stage="home", not
 * stage="admin") — the password itself, verified server-side via
 * adminLogin, is the actual gate from here on, not a Firebase role.
 */
export default function AdminLockScreen() {
  const { loginWithToken } = useAdminSession()
  const [mode, setMode] = useState('checking') // 'checking' | 'setup' | 'locked' | 'check-error'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [checkError, setCheckError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const runCheck = () => {
    setMode('checking')
    setCheckError('')
    checkAdminPasswordExists()
      .then((exists) => {
        setMode(exists ? 'locked' : 'setup')
      })
      .catch((err) => {
        // FIX: previously silently defaulted to 'locked' here,
        // permanently hiding the setup screen with no visible cause
        // if this check failed for any reason (most likely: this
        // Cloud Function had never been deployed yet, so the call
        // failed with functions/not-found). Now shows a real error
        // and a Retry button instead of guessing.
        console.error('[AdminLockScreen] checkAdminPasswordExists failed', { code: err?.code, message: err?.message })
        setCheckError(
          err?.code === 'functions/not-found'
            ? 'The admin setup check is not available yet — the Cloud Function may not be deployed.'
            : err?.message || 'Could not check admin setup status.'
        )
        setMode('check-error')
      })
  }

  useEffect(runCheck, [])

  const handleSetup = async () => {
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setSubmitting(true)
    try {
      const ok = await setAdminPassword(password)
      if (!ok) {
        setError('Could not set the password. Please try again.')
        return
      }
      const token = await adminLogin(password)
      if (token) loginWithToken(token)
      else setError('Password was set, but automatic login failed — try entering it again.')
    } catch (err) {
      setError(err?.message || 'Could not set the password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async () => {
    setError('')
    if (!password) {
      setError('Enter your admin password.')
      return
    }
    setSubmitting(true)
    try {
      const token = await adminLogin(password)
      if (token) {
        loginWithToken(token)
      } else {
        setError('Incorrect password.')
        setPassword('')
      }
    } catch (err) {
      setError(err?.message || 'Could not verify the password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'checking') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
      </div>
    )
  }

  if (mode === 'check-error') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
        <div className="w-full max-w-[360px] text-center">
          <p className="text-lg font-bold tracking-tight text-gray-900">Campinity Admin</p>
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-6">
            <p className="text-sm font-semibold text-gray-900">Couldn't check admin setup status</p>
            <p className="mt-1.5 text-sm text-gray-400">{checkError}</p>
            <button
              type="button"
              onClick={runCheck}
              className="mt-5 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 transition-all duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <p className="text-lg font-bold tracking-tight text-gray-900">Campinity Admin</p>
          <p className="mt-1 text-sm text-gray-400">
            {mode === 'setup' ? 'Set up Campinity Admin' : 'Secure workspace'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-6">
          {mode === 'setup' ? (
            <>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Create admin password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
                autoFocus
              />
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-3">
                Confirm admin password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
              />
              {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
              <button
                type="button"
                onClick={handleSetup}
                disabled={submitting}
                className="mt-5 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
              >
                {submitting ? 'Creating…' : 'Create Admin Password'}
              </button>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Enter admin password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-center tracking-[0.3em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
                autoFocus
                placeholder="••••••••"
              />
              {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
              <button
                type="button"
                onClick={handleLogin}
                disabled={submitting}
                className="mt-5 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
              >
                {submitting ? 'Unlocking…' : 'Unlock Dashboard'}
              </button>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-gray-400">Protected administrative workspace</p>
      </div>
    </div>
  )
}
