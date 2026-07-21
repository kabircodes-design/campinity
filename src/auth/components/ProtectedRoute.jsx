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
 * (and as ProtectedRoute's own fallback below) to compute a single
 * redirect target, NOT re-applied as a recurring per-navigation guard
 * that second-guesses a completed profile.
 *
 * profileCompleted is checked FIRST and unconditionally — once true,
 * this always returns '/home' no matter what verifiedCampus,
 * verificationStatus, or verificationMethod say. Campus verification is
 * a one-time onboarding decision, not a standing condition on app
 * access; a skipped or never-verified campus must never re-route a
 * fully onboarded user away from the app.
 *
 * Below that, for a profile that ISN'T complete yet:
 *  - verificationMethod === 'skipped' means the user already made their
 *    decision about campus verification (they chose to skip it) — this
 *    is a completed step, so it routes straight to /create-profile, not
 *    back to /campus-verification. Skip sets verificationStatus to
 *    'not_started', which is otherwise indistinguishable from a profile
 *    that has never touched campus verification at all — checking
 *    verificationStatus alone (as an earlier version of this function
 *    did) is exactly what caused the Campus Verification <-> Create
 *    Profile loop: any re-evaluation while profileCompleted briefly read
 *    as false sent an already-skipped user back to Campus Verification,
 *    which re-saves the same skip fields and hardcodes
 *    navigate('/create-profile') — repeating forever.
 *  - A genuinely undecided profile (no method chosen yet) or an ID-card
 *    review still "pending" both still correctly land on
 *    /campus-verification, unchanged from the original design.
 */
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

/**
 * Whether a profile has actually completed campus verification —
 * distinct from being allowed into the app at all. Skipping verification
 * is a fully supported way to enter Campinity; this helper exists so
 * future verified-only actions (posting, notes upload, marketplace
 * listings, etc.) can gate the ACTION without ever gating entry to the
 * app itself. Not used by ProtectedRoute's own guards below — app access
 * is decided purely by profileCompleted.
 */
export function isCampusVerified(profile) {
  return profile?.verifiedCampus === true
}

/**
 * Guards onboarding + home + admin routes.
 *
 * stage:
 *  - 'verify-email' -> only for users who have NOT verified their email yet
 *  - 'onboarding'   -> /campus-verification and /create-profile; both are
 *                      freely reachable once email is verified and the
 *                      profile isn't complete yet (no forced ordering
 *                      between the two — see resolveOnboardingRoute above)
 *  - 'home'         -> requires a verified-email, fully-onboarded user.
 *                      "Fully-onboarded" means profileCompleted === true
 *                      ONLY — verifiedCampus is never checked here.
 *                      Skipping campus verification must never block
 *                      entry once the profile itself is complete.
 *  - 'admin'        -> same as 'home', plus role === 'admin'; otherwise
 *                      renders "Access denied" in place rather than
 *                      redirecting elsewhere
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

  // stage === 'home' or 'admin' from here on — both require a completed
  // profile. verifiedCampus is intentionally NOT part of this check:
  // skipping campus verification is a supported way to enter the app.
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