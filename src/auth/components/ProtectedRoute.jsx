import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useIsAdmin } from '../../hooks/useIsAdmin.js'
import Loader from './Loader.jsx'

export function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader size="lg" tone="dark" />
    </div>
  )
}

export function resolveOnboardingRoute(profile) {
  if (profile?.profileCompleted) {
    return '/home'
  }

  if (profile?.verificationMethod === 'skipped') {
    return '/create-profile'
  }

  const status = profile?.verificationStatus
  if (!status || status === 'not_started' || status === 'pending') {
    return '/campus-verification'
  }

  return '/create-profile'
}

export function isCampusVerified(profile) {
  return profile?.verifiedCampus === true
}

export default function ProtectedRoute({ stage, children }) {
  // Reads the ONE shared, persistent auth subscription (AuthContext,
  // mounted once in main.jsx) instead of calling useAuthUser() itself
  // — this used to create a brand-new onAuthStateChanged + profile
  // onSnapshot + presence-heartbeat listener on every single
  // navigation (every route has its own ProtectedRoute instance), which
  // is why `loading` went back to true and this component's own
  // spinner flashed on every page change. Now `loading` only matters
  // once, at initial app load.
  const { user, profile, loading } = useAuth()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  // A verification-link click can land on this route with no active
  // session at all (a different browser/device than the one used to
  // sign up, or a session that already expired) — the token itself,
  // not an authenticated session, is what verifyEmailVerificationToken
  // checks server-side. Let VerifyEmailPage render and handle it.
  if (stage === 'verify-email' && !user && new URLSearchParams(location.search).has('token')) {
    return children
  }

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

  // /admin has its own independent gate (AdminGate/AdminLockScreen's
  // password + server-verified session token) that has nothing to do
  // with normal-user onboarding. Requiring profileCompleted here as
  // well was actively wrong (an authenticated, email-verified admin
  // could get routed through /campus-verification and dumped on /home
  // before ever reaching AdminPage) and unnecessary (AdminLockScreen
  // never reads `profile` at all). Still requires real Firebase auth +
  // a verified email above — only the onboarding-completion
  // requirement is skipped.
  if (stage === 'admin-entry') {
    return children
  }

  if (!profile?.profileCompleted) {
    return <Navigate to={resolveOnboardingRoute(profile)} replace />
  }

  if (stage === 'admin') {
    if (adminLoading) return <FullScreenLoader />
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center px-6 text-center">
          <p className="text-sm text-ink-soft">Access denied — admin only.</p>
        </div>
      )
    }
  }

  return children
}

export function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (user && user.emailVerified && profile?.profileCompleted) {
    return <Navigate to="/home" replace />
  }

  return children
}
