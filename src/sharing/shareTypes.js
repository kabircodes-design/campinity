/**
 * Shared constants for the Sharing System — the one place both
 * chatService.js (writing messages) and SharedCard.jsx (rendering
 * them) read from, so a label or a URL pattern is never defined
 * twice.
 */

export const SHARE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  SHARED_POST: 'shared_post',
  SHARED_PROFILE: 'shared_profile',
  SHARED_STORY: 'shared_story',
  SHARED_EVENT: 'shared_event',
  SHARED_COMMUNITY: 'shared_community',
  SHARED_CLUB: 'shared_club',
  SHARED_RADAR_PROFILE: 'shared_radar_profile',
  FORWARDED_MESSAGE: 'forwarded_message'
}

/** Fallback last-message preview text in the chat list, when a shared payload has no title to show. */
export const SHARE_TYPE_LABELS = {
  image: 'Sent a photo',
  shared_post: 'Shared a post',
  shared_profile: 'Shared a profile',
  shared_story: 'Shared a story',
  shared_event: 'Shared an event',
  shared_community: 'Shared a community',
  shared_club: 'Shared a club',
  shared_radar_profile: 'Shared a suggested connection',
  forwarded_message: 'Forwarded a message'
}

/**
 * Canonical deep-link paths — one function every "View Post" / "Open
 * Club" action and the future Copy Link feature (Phase 5) both call,
 * rather than each place inventing its own path string.
 */
const CANONICAL_PATTERNS = {
  post: (id) => `/post/${id}`,
  profile: (id) => `/student/${id}`, // id here is a username, matching this project's existing /student/:username route
  community: (id) => `/community/${id}`,
  club: (id) => `/community/${id}`, // clubs are a community `type` in this project's schema, not a separate collection — same route
  event: (id) => `/event/${id}`,
  story: (id) => `/story/${id}`
}

export function getCanonicalUrl(referenceType, id) {
  const pattern = CANONICAL_PATTERNS[referenceType]
  return pattern ? pattern(id) : null
}
