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
  file: 'Sent a file',
  voice: '🎤 Voice message',
  call: '📞 Call',
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

/**
 * Public base URL for links that leave the app. Inside the Android app
 * window.location.origin is the WebView's local origin
 * (https://localhost), so links shared from the phone used to point at
 * localhost and opened nothing for the recipient. The default matches
 * the Cloud Functions' own APP_BASE_URL default; VITE_PUBLIC_APP_URL
 * overrides it (e.g. a custom domain).
 */
const DEFAULT_PUBLIC_APP_URL = 'https://campinity-app.vercel.app'

export function getPublicAppUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/+$/, '')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  // Real web deployments keep their own origin (preview builds, custom
  // domains); local/native origins fall back to the public site.
  if (!origin || /^(https?|capacitor):\/\/localhost(:\d+)?$/i.test(origin) || /^https?:\/\/(127\.0\.0\.1|10\.|192\.168\.)/.test(origin)) {
    return DEFAULT_PUBLIC_APP_URL
  }
  return origin
}

export function getShareUrl(referenceType, id) {
  const path = getCanonicalUrl(referenceType, id)
  return path ? `${getPublicAppUrl()}${path}` : null
}

/**
 * Copies text and reports whether it really worked: async Clipboard
 * API first, then the legacy execCommand path (older WebViews). Never
 * resolves true unless one of them succeeded.
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/**
 * Opens the system share sheet: Capacitor Share on the Android app (the
 * WebView has no Web Share API), the Web Share API in browsers that have
 * it. Resolves { ok: true } when the sheet completed, { cancelled: true }
 * when the user backed out, { unsupported: true } when neither exists,
 * or { error } for a real failure — callers never claim "Shared" unless
 * ok is true.
 */
export async function nativeShare({ title, text, url }) {
  let parsed = null
  try {
    parsed = new URL(url)
  } catch {
    parsed = null
  }
  // A real, public http(s) link only — never the app's own localhost origin.
  if (!parsed || !/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.hostname === 'localhost') {
    return { error: 'Invalid link' }
  }
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share')
      const { value: can } = await Share.canShare().catch(() => ({ value: true }))
      if (!can) return { unsupported: true }
      await Share.share({ title, text, url, dialogTitle: 'Share via' })
      return { ok: true }
    }
  } catch (err) {
    return /cancel/i.test(String(err?.message || err)) ? { cancelled: true } : { error: err?.message || 'Share failed' }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url })
      return { ok: true }
    } catch (err) {
      return err?.name === 'AbortError' ? { cancelled: true } : { error: err?.message || 'Share failed' }
    }
  }
  return { unsupported: true }
}

/** True where nativeShare can open a system sheet. */
export async function canUseNativeShare() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) return true
  } catch {
    // not in Capacitor
  }
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}
