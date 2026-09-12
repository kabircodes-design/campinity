/**
 * Shared Google Sign-In logic for SignupPage and LoginPage — one place
 * for the popup/redirect handling and the post-auth routing, so both
 * pages behave identically and onboarding/profile-creation logic isn't
 * duplicated.
 */
import { getRedirectResult, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { resolveOnboardingRoute } from '../components/ProtectedRoute.jsx'
import { ensureUserDoc } from './userProfile.js'

// Errors that mean the popup itself couldn't be used at all — Firebase's
// own recommended recovery is to fall back to signInWithRedirect for
// these specific cases (popup blockers, in-app browsers/webviews that
// don't support window.open). A user deliberately dismissing the popup
// (auth/popup-closed-by-user, auth/cancelled-popup-request) is NOT
// included here — that should surface as "cancelled," never silently
// retried as a redirect.
const POPUP_FALLBACK_CODES = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])

/**
 * Tries signInWithPopup first (best UX where it works), falling back to
 * signInWithRedirect only for the errors above. Returns `{ user }` when
 * popup sign-in completed during this call, or `{ redirecting: true }`
 * when a redirect was just started — the page is about to navigate
 * away, so the caller has nothing further to do.
 */
export async function signInWithGoogle(auth, googleProvider) {
  try {
    const { user } = await signInWithPopup(auth, googleProvider)
    return { user }
  } catch (err) {
    if (POPUP_FALLBACK_CODES.has(err?.code)) {
      await signInWithRedirect(auth, googleProvider)
      return { redirecting: true }
    }
    throw err
  }
}

/**
 * Call once on mount of any page that offers Google sign-in, to pick up
 * the result of a signInWithRedirect() that was started on the previous
 * page load. Resolves to null when there is no pending redirect result
 * (the common case — most sign-ins complete via the popup path).
 */
export async function completeGoogleRedirect(auth) {
  const result = await getRedirectResult(auth)
  return result?.user || null
}

/**
 * Post-auth routing for a Google-authenticated user, shared by the
 * popup path and the redirect-completion path so the
 * "verify email if needed, else ensure the Campinity profile doc exists
 * and continue onboarding" logic exists in exactly one place.
 */
export async function routeAfterGoogleSignIn(user, navigate) {
  if (!user.emailVerified) {
    navigate('/verify-email')
    return
  }
  const profile = await ensureUserDoc(user)
  navigate(resolveOnboardingRoute(profile))
}
