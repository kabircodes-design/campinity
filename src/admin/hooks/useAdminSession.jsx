/**
 * REBUILT for the new architecture — now holds the real session
 * token returned by adminLogin, not a bare boolean. Still deliberately
 * in-memory only (plain useState, no localStorage/sessionStorage),
 * per explicit instruction: "do not automatically trust a previous
 * localStorage flag such as isAdmin=true." A full page refresh
 * remounts this provider and clears the token — that's intended:
 * "every time /admin is opened... enter passcode... do not
 * automatically unlock because the browser previously visited."
 *
 * Within a single page load, once logged in, the token persists
 * across switching dashboard sections without re-prompting.
 *
 * Every privileged action (adminResolveReport, etc) must include
 * this token in its Cloud Function call — see AdminReportsPage.jsx.
 * The server independently verifies the token on every call
 * (requireValidAdminSession in index.js); the client holding it is
 * not itself proof of anything the server doesn't re-check.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AdminSessionContext = createContext(null)

export function AdminSessionProvider({ children }) {
  const [sessionToken, setSessionToken] = useState(null)

  const loginWithToken = useCallback((token) => setSessionToken(token), [])
  const logout = useCallback(() => setSessionToken(null), [])

  const value = useMemo(
    () => ({ sessionToken, isLoggedIn: Boolean(sessionToken), loginWithToken, logout }),
    [sessionToken, loginWithToken, logout]
  )

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext)
  if (!context) {
    throw new Error('useAdminSession must be used within an AdminSessionProvider')
  }
  return context
}
