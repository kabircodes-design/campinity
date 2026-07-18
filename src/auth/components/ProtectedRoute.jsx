import { Navigate, useLocation } from 'react-router-dom'
import { useAuthUser } from '../hooks/useAuthUser.js'
import Loader from './Loader.jsx'

export function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader size="lg" tone="dark" />
    </div>
  )
}

/**
 * The one-time "what's next" decision — mirrors the login-flow spec
 * exactly. Used right after a successful login/signup/email-verification
 * to compute a single initial redirect target, NOT re-applied as a
 * recurring per-navigation guard (see ProtectedRoute's "onboarding" stage
 * below for why: forcing this same granular check on every route mount
 * would fight the Skip button's own navigation, since Skip intentionally
 * leaves verificationStatus as "not_started" while still advancing the
 * user to /create-profile).
 */
export function resolveOnboardingRoute(profile) {
  if (!profile?.profileCompleted) {
    const status = profile?.verificationStatus
    if (!status || status === 'not_started' || status === 'pending') {
      return '/campus-verification'
    }
    return '/create-profile'
  }
  return '/home'
}

/**
 * Guards onboarding + home + admin routes.
 *
 * stage:
 *  - 'verify-email' -> only for users who have NOT verified their email yet
 *  - 'onboarding'   -> /campus-verification and /create-profile; both are
 *                      freely reachable once email is verified and the
 *                      profile isn't complete yet (no forced ordering
 *                      between the two — see note above)
 *  - 'home'         -> requires a verified, fully-onboarded user
 *  - 'admin'        -> requires a verified, fully-onboarded user AND
 *                      role === 'admin'; otherwise renders "Access denied"
 *                      in place rather than redirecting elsewhere
 */
export default function ProtectedRoute({ stage, children }) {
  const { user, profile, loading } = useAuthUser()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (stage === 'verify-email') {
    if (user.emailVerified) {
      return <Navigate to={resolveOnboardingRoute(profile)} replace />
    }
    return children
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  if (stage === 'onboarding') {
    if (profile?.profileCompleted) {
      return <Navigate to="/home" replace />
    }
    return children
  }

  // stage === 'home' or 'admin' from here on — both require a completed profile.
  if (!profile?.profileCompleted) {
    return <Navigate to={resolveOnboardingRoute(profile)} replace />
  }

  if (stage === 'admin' && profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6 text-center">
        <p className="text-sm text-ink-soft">Access denied — admin only.</p>
      </div>
    )
  }

  return children
}

/**
 * Guards /login and /signup — a fully authenticated, fully onboarded user
 * has no reason to see either, so they're bounced to /home. Anyone
 * mid-flow (unverified email, incomplete profile) is left alone here;
 * their own protected routes handle steering them forward.
 */
export function PublicRoute({ children }) {
  const { user, profile, loading } = useAuthUser()

  if (loading) return <FullScreenLoader />

  if (user && user.emailVerified && profile?.profileCompleted) {
    return <Navigate to="/home" replace />
  }

  return children
} 