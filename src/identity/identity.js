/**
 * Campinity identity resolution — the ONE place that decides what name to
 * show for a user.
 *
 * Root cause this replaces: dozens of `profile?.displayName || 'Student'`
 * fallbacks. Onboarding stores the name as `fullName` (no `displayName`),
 * the signed-in user's profile was used raw, and a failed profile fetch was
 * cached as if the account were deleted — so active accounts showed
 * "Student".
 *
 * Profile states (what callers pass in):
 *   undefined                  -> not loaded yet          ("loading")
 *   { status: 'unavailable' }  -> fetch failed / offline   ("unavailable")
 *   null | { status: 'deleted' } -> account no longer exists ("deleted")
 *   { moderationStatus: 'suspended' } | { status: 'suspended' } ("suspended")
 *   any other profile object   -> active account          ("active")
 *
 * Policy:
 *   active      -> displayName, else fullName, else @username, else the name
 *                  stored on the content, else "Student" (last resort only)
 *   deleted /
 *   suspended   -> "Student", no username, no photo (privacy)
 *   loading /
 *   unavailable -> the name stored on the content (snapshot) if any, else ''
 *                  — never "Student" just because a request is slow/failing
 */
export const FALLBACK_NAME = 'Student'

const clean = (v) => (typeof v === 'string' ? v.trim() : '')

/** Best real name on a profile-like object (displayName > fullName > name). */
export function profileName(p) {
  if (!p) return ''
  return clean(p.displayName) || clean(p.fullName) || clean(p.name)
}

export function accountStatus(profile) {
  if (profile === undefined) return 'loading'
  if (profile === null) return 'deleted'
  if (profile.status === 'unavailable') return 'unavailable'
  if (profile.status === 'deleted') return 'deleted'
  if (profile.status === 'suspended' || profile.moderationStatus === 'suspended') return 'suspended'
  return 'active'
}

/** Adds a resolved `displayName` to a raw users/{uid} document (fullName fallback). */
export function normalizeUserDoc(raw) {
  if (!raw) return raw
  const name = profileName(raw)
  return name && raw.displayName !== name ? { ...raw, displayName: name } : raw
}

/**
 * @param profile  see "Profile states" above
 * @param snapshot { name, username } stored on the content at write time (optional)
 * @returns { name, username, status, hidden }
 */
export function resolveIdentity(profile, snapshot = {}) {
  const status = accountStatus(profile)
  const snapName = clean(snapshot && snapshot.name)
  const snapUser = clean(snapshot && snapshot.username)
  if (status === 'deleted' || status === 'suspended') return { name: FALLBACK_NAME, username: '', status, hidden: true }
  if (status === 'loading' || status === 'unavailable') return { name: snapName, username: snapUser, status, hidden: false }
  const username = clean(profile.username) || snapUser
  const name = profileName(profile) || snapName || (username ? `@${username}` : '') || FALLBACK_NAME
  return { name, username, status, hidden: false }
}

/** Shorthand: the name to render. */
export function displayNameOf(profile, snapshotName) {
  return resolveIdentity(profile, { name: snapshotName }).name
}
