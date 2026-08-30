import { Navigate, useLocation } from 'react-router-dom'
import { useAuthUser } from '../hooks/useAuthUser.js'
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
  const { user, profile, loading } = useAuthUser()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
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
  const { user, profile, loading } = useAuthUser()

  if (loading) return <FullScreenLoader />

  if (user && user.emailVerified && profile?.profileCompleted) {
    return <Navigate to="/home" replace />
  }

  return children
}
