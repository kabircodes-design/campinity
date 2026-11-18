/**
 * Admin session state (API v2).
 *
 * The session token is kept in localStorage so the admin app can resume
 * after a restart within the session window (8 h absolute, 30 min idle —
 * both enforced by the SERVER). That is safe only because the token alone
 * is useless: every call must also be signed by this device's
 * non-exportable key, and the server re-checks the device on each call.
 *
 * The session ends locally when:
 *  - the absolute expiry passes (timer),
 *  - any admin call comes back unauthenticated (expired / revoked / idle),
 *  - the admin locks the panel.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { SESSION_ENDED_EVENT } from '../services/adminCallable.js'

const STORAGE_KEY = 'campinity-admin:session'
const AdminSessionContext = createContext(null)

function loadStored() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (v && typeof v.sessionToken === 'string' && typeof v.expiresAtMs === 'number' && v.expiresAtMs > Date.now()) return v
  } catch {}
  return null
}
function store(v) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

export function AdminSessionProvider({ children }) {
  const [session, setSession] = useState(loadStored)
  const [endedReason, setEndedReason] = useState('')

  const loginWithSession = useCallback((s) => {
    store(s)
    setEndedReason('')
    setSession(s)
  }, [])
  const logout = useCallback((reason = '') => {
    store(null)
    setEndedReason(reason)
    setSession(null)
  }, [])

  // Server said the session is no longer valid.
  useEffect(() => {
    const onEnded = (e) => logout(e.detail?.message || 'Your admin session ended. Sign in again.')
    window.addEventListener(SESSION_ENDED_EVENT, onEnded)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded)
  }, [logout])

  // Absolute expiry.
  useEffect(() => {
    if (!session) return undefined
    const left = session.expiresAtMs - Date.now()
    if (left <= 0) {
      logout('Your admin session expired. Sign in again.')
      return undefined
    }
    const t = window.setTimeout(() => logout('Your admin session expired. Sign in again.'), Math.min(left, 2 ** 31 - 1))
    return () => window.clearTimeout(t)
  }, [session, logout])

  const value = useMemo(
    () => ({
      sessionToken: session?.sessionToken || null,
      deviceId: session?.deviceId || null,
      expiresAtMs: session?.expiresAtMs || null,
      isLoggedIn: Boolean(session),
      endedReason,
      loginWithSession,
      logout
    }),
    [session, endedReason, loginWithSession, logout]
  )
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext)
  if (!context) throw new Error('useAdminSession must be used within an AdminSessionProvider')
  return context
}
