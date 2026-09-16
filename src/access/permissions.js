/**
 * Single source of truth for verification-gated feature access.
 * verifiedCampus (users/{uid}.verifiedCampus) is the existing,
 * already-established field this reads — confirmed via audit to be
 * used across profileService.js, verificationService.js,
 * ProfileHeader.jsx, and others already. Not a new field, not a
 * second verification system.
 *
 * This is a UI/service-layer convenience only — it does NOT replace
 * Firestore security rules. A malicious user calling Firestore
 * directly is stopped by the rules themselves (see firestore.rules),
 * not by this file. This exists so components don't scatter
 * `if (!profile?.verifiedCampus)` checks with inconsistent feature
 * names throughout the codebase.
 */
export const FEATURES = {
  VIEW_CAMPUS_PDF: 'VIEW_CAMPUS_PDF',
  DOWNLOAD_CAMPUS_PDF: 'DOWNLOAD_CAMPUS_PDF',
  SAVE_CAMPUS_RESOURCE: 'SAVE_CAMPUS_RESOURCE',
  JOIN_PRIVATE_COMMUNITY: 'JOIN_PRIVATE_COMMUNITY',
  CREATE_COMMUNITY: 'CREATE_COMMUNITY',
  // Added for the verification-gated access control pass — every one of
  // these has a matching server-side enforcement point (a Firestore
  // create rule, or a Storage write rule) documented in that rule's own
  // comment; this file is the UI-layer convenience, not the boundary.
  CREATE_POST: 'CREATE_POST',
  UPLOAD_POST_MEDIA: 'UPLOAD_POST_MEDIA',
  SEND_MESSAGE: 'SEND_MESSAGE',
  CREATE_MARKETPLACE_LISTING: 'CREATE_MARKETPLACE_LISTING',
  CREATE_LOST_FOUND: 'CREATE_LOST_FOUND'
}

// Every listed feature currently requires verification. Kept as an
// explicit set (not "everything defaults to gated") so adding a new
// FEATURES entry that should NOT be gated doesn't silently become
// restricted by omission.
const GATED_FEATURES = new Set(Object.values(FEATURES))

export function canUseFeature(profile, feature) {
  if (!GATED_FEATURES.has(feature)) return true
  return Boolean(profile?.verifiedCampus)
}
