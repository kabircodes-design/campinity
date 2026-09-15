import { createContext, useContext } from 'react'
import { useAuthUser } from '../auth/hooks/useAuthUser.js'

const AuthContext = createContext(null)

/**
 * THE fix for the dominant root cause of "navigation feels like a fresh
 * page load": every one of the ~50 routes in App.jsx wraps its page in
 * its own <ProtectedRoute>, and ProtectedRoute called useAuthUser()
 * directly — which sets up a NEW onAuthStateChanged listener, a NEW
 * onSnapshot(users/{uid}) listener, and a NEW presence-heartbeat
 * interval, EVERY SINGLE TIME. Navigating Home → Messages didn't just
 * swap content; it tore down and recreated the entire auth/profile
 * subscription, starting from `loading: true` again — which is exactly
 * why ProtectedRoute's `if (loading) return <FullScreenLoader/>` fired
 * on every navigation, producing the blank-flash the whole task is
 * about.
 *
 * AuthProvider is mounted ONCE, in main.jsx, above <App/> — the same
 * level as PostingStatusProvider/CallProvider. useAuthUser() now runs
 * exactly once for the entire session; ProtectedRoute/PublicRoute
 * (see ProtectedRoute.jsx) now READ from this context instead of
 * creating their own listeners, so `loading` only matters once, at
 * initial app load, never again on subsequent navigation.
 */
export function AuthProvider({ children }) {
  const value = useAuthUser()
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
