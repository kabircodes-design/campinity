import { useCallback, useEffect, useState } from 'react'
import { KeyRound, LogOut, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react'
import {
  adminLogin,
  checkAdminPasswordExists,
  enrollThisDevice,
  getAdminCapabilities,
  setAdminPassword
} from '../services/adminAuthService.js'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { devicePlatform, getEnrolledDevice, resetDeviceKey } from '../security/deviceKey.js'

/**
 * Admin sign-in (API v2, device-bound). Order of checks:
 *  1. backend capabilities — refuse to run against an older backend
 *     (e.g. the verification list that auto-approved on open);
 *  2. first-time password setup (only if none exists);
 *  3. this device enrolled?  no  -> enrollment (code + password + key proof)
 *                            yes -> password + signed challenge.
 * The Firebase sign-in has already happened (web route / admin app root).
 */
const input =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 transition-colors duration-150'
const primary =
  'w-full rounded-xl bg-blue-600 text-white text-[15px] font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150'

function Frame({ children, subtitle, onSignOut, accountLabel }) {
  return (
    <div className="min-h-dvh bg-[#f8fafc] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-7">
          <span className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold">C</span>
          <p className="mt-3 text-[19px] font-bold tracking-tight text-gray-900">Campinity Admin</p>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5 sm:p-6">{children}</div>
        {(onSignOut || accountLabel) && (
          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-500">
            {accountLabel && <span className="truncate max-w-[220px]">{accountLabel}</span>}
            {onSignOut && (
              <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <LogOut className="w-3.5 h-3.5" /> Switch account
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const errText = (err, fallback) => {
  if (err?.code === 'functions/resource-exhausted' || err?.code === 'functions/permission-denied' || err?.code === 'functions/deadline-exceeded' || err?.code === 'functions/already-exists' || err?.code === 'functions/invalid-argument') return err.message
  if (err?.code === 'functions/unavailable' || /network|failed to fetch/i.test(err?.message || '')) return 'No connection. Check your internet and try again.'
  return err?.message || fallback
}

export default function AdminLockScreen({ onSignOut, accountLabel }) {
  const { loginWithSession, endedReason } = useAdminSession()
  const [mode, setMode] = useState('checking') // checking | check-error | outdated | setup | enroll | login
  const [checkError, setCheckError] = useState('')
  const [device, setDevice] = useState(getEnrolledDevice)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [label, setLabel] = useState(devicePlatform() === 'android' ? 'My phone' : 'This browser')
  const [error, setError] = useState('')
  const [deviceDenied, setDeviceDenied] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const runCheck = useCallback(async () => {
    setMode('checking')
    setCheckError('')
    try {
      await getAdminCapabilities()
    } catch (err) {
      setCheckError(err?.code === 'admin/backend-outdated' || err?.code === 'functions/not-found' || err?.code === 'functions/internal' ? '' : errText(err, 'Could not reach the admin backend.'))
      setMode(err?.code === 'functions/unavailable' || /network|failed to fetch/i.test(err?.message || '') ? 'check-error' : 'outdated')
      return
    }
    try {
      const exists = await checkAdminPasswordExists()
      setMode(!exists ? 'setup' : getEnrolledDevice() ? 'login' : 'enroll')
    } catch (err) {
      setCheckError(errText(err, 'Could not check the admin setup.'))
      setMode('check-error')
    }
  }, [])
  useEffect(() => {
    runCheck()
  }, [runCheck])

  const submitSetup = async () => {
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError("Passwords don't match.")
    setSubmitting(true)
    try {
      if (!(await setAdminPassword(password))) return setError('Could not set the password. Please try again.')
      setPassword('')
      setConfirmPassword('')
      setMode('enroll')
    } catch (err) {
      setError(errText(err, 'Could not set the password.'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitEnroll = async () => {
    setError('')
    if (code.replace(/[^0-9a-z]/gi, '').length !== 12) return setError('Enter the 12-character enrollment code.')
    if (!password) return setError('Enter your admin password.')
    setSubmitting(true)
    try {
      const res = await enrollThisDevice({ password, enrollmentCode: code, label: label.trim() || 'My device' })
      if (!res.ok) {
        setPassword('')
        return setError('Incorrect password.')
      }
      loginWithSession(res.session)
    } catch (err) {
      setError(errText(err, 'Enrollment failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const submitLogin = async () => {
    setError('')
    setDeviceDenied(false)
    if (!password) return setError('Enter your admin password.')
    setSubmitting(true)
    try {
      const res = await adminLogin({ password, deviceId: device.deviceId })
      if (!res.ok) {
        setPassword('')
        return setError('Incorrect password.')
      }
      loginWithSession(res.session)
    } catch (err) {
      if (err?.code === 'functions/permission-denied' && /not authorized/i.test(err.message || '')) setDeviceDenied(true)
      setError(errText(err, 'Sign-in failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const reEnroll = async () => {
    await resetDeviceKey()
    setDevice(null)
    setDeviceDenied(false)
    setError('')
    setPassword('')
    setMode('enroll')
  }

  const frameProps = { onSignOut, accountLabel }

  if (mode === 'checking') {
    return (
      <Frame {...frameProps} subtitle="Checking the admin backend…">
        <div className="py-6 flex justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
        </div>
      </Frame>
    )
  }
  if (mode === 'check-error' || mode === 'outdated') {
    return (
      <Frame {...frameProps}>
        <div className="flex gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{mode === 'outdated' ? 'Admin backend not updated yet' : "Couldn't reach the admin backend"}</p>
            <p className="mt-1 text-sm text-gray-500">
              {mode === 'outdated'
                ? 'This version needs the device-secured admin Cloud Functions (API v2). Until they are deployed, sign-in is disabled here so nothing runs against the old backend.'
                : checkError}
            </p>
          </div>
        </div>
        <button type="button" onClick={runCheck} className={`${primary} mt-5`}>
          Retry
        </button>
      </Frame>
    )
  }

  return (
    <Frame {...frameProps} subtitle={mode === 'setup' ? 'First-time setup' : mode === 'enroll' ? 'Authorize this device' : 'Secure workspace'}>
      {endedReason && mode === 'login' && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-gray-700">{endedReason}</p>}

      {mode === 'setup' && (
        <form onSubmit={(e) => (e.preventDefault(), submitSetup())} className="space-y-3">
          <p className="text-sm text-gray-500">No admin password exists yet. Create one — it is stored only as a salted hash on the server.</p>
          <input type="password" autoComplete="new-password" placeholder="New admin password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          <input type="password" autoComplete="new-password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={input} />
          {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={submitting} className={primary}>{submitting ? 'Saving…' : 'Create admin password'}</button>
        </form>
      )}

      {mode === 'enroll' && (
        <form onSubmit={(e) => (e.preventDefault(), submitEnroll())} className="space-y-3">
          <div className="flex gap-3 rounded-xl bg-blue-50 p-3">
            <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-gray-700">
              This {devicePlatform() === 'android' ? 'phone' : 'browser'} isn't authorized yet. Enter a one-time enrollment code from the owner script on your laptop, or from
              Admin → Devices on an already-authorized device.
            </p>
          </div>
          <input
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-label="Enrollment code"
            className={`${input} text-center font-mono tracking-[0.2em]`}
          />
          <input type="password" autoComplete="current-password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Admin password" className={input} />
          <input placeholder="Device name" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} aria-label="Device name" className={input} />
          {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={submitting} className={primary}>{submitting ? 'Authorizing…' : 'Authorize this device'}</button>
        </form>
      )}

      {mode === 'login' && (
        <form onSubmit={(e) => (e.preventDefault(), submitLogin())} className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-gray-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="truncate">Authorized device{device?.label ? `: ${device.label}` : ''}</span>
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="password" autoComplete="current-password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Admin password" className={`${input} pl-10`} autoFocus />
          </div>
          {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={submitting} className={primary}>{submitting ? 'Verifying…' : 'Unlock'}</button>
          {deviceDenied && (
            <button type="button" onClick={reEnroll} className="w-full text-center text-[13px] font-semibold text-blue-600 py-1">
              This device was revoked — enroll it again with a new code
            </button>
          )}
        </form>
      )}
    </Frame>
  )
}
