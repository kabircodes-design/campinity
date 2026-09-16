import { useAuth } from '../context/AuthContext.jsx'

/**
 * REBUILT for the verification-gated access control pass — this used to
 * run its own separate, module-cached getUserProfile() fetch, entirely
 * independent of AuthContext's own profile (which useAuthUser.js already
 * keeps live via a Firestore onSnapshot() listener on users/{uid}, not a
 * one-time read). That meant two real problems: every PostCard etc.
 * duplicated a fetch AuthContext already had in hand, and — more
 * importantly — a user who gets verified (or unverified) while the app
 * is open never saw it reflected here without an explicit
 * invalidateVerificationCache() call, which nothing in the codebase
 * actually made (confirmed by grep: that function was exported but
 * never imported anywhere). Reading directly from the shared, already-
 * live subscription fixes both: one source of truth, zero extra reads,
 * and it updates in real time the moment the underlying document does —
 * including the moment an admin approves or revokes verification.
 */
export function useMyVerification() {
  const { profile, loading } = useAuth()
  if (loading) return null // null = still loading, same contract as before
  return Boolean(profile?.verifiedCampus)
}
