/**
 * Single resolver for "what image represents this user" — used
 * everywhere a profile identity image is rendered, so this logic
 * exists in exactly one place instead of being reimplemented per
 * component. Per the priority order specified:
 *
 * 1. avatarMode === 'avatar' AND campusAvatarUrl exists -> avatar
 * 2. the existing 'avatar' field (this app's real-photo field,
 *    confirmed by usage across profileService.js — despite the name,
 *    it has always meant "the user's actual photo", not a stylized
 *    avatar) exists -> that photo
 * 3. campusAvatarUrl exists anyway (no photo, but an avatar was
 *    created at some point) -> avatar
 * 4. neither -> null, meaning "use the existing app-wide fallback"
 *    (initials/color, exactly as every component already handles a
 *    missing avatar today — this resolver does not invent a new
 *    fallback, it returns null so existing fallback code paths keep
 *    working unchanged).
 *
 * Accepts any object with { avatar, campusAvatarUrl, avatarMode } —
 * works with whatever shape a given component already has in scope
 * (a full profile object, a lightweight post-author snapshot, etc.)
 * rather than requiring a specific type.
 */
export function getProfileIdentityImage(user) {
  if (!user) return null

  if (user.avatarMode === 'avatar' && user.campusAvatarUrl) {
    return user.campusAvatarUrl
  }
  if (user.avatar) {
    return user.avatar
  }
  if (user.campusAvatarUrl) {
    return user.campusAvatarUrl
  }
  return null
}
