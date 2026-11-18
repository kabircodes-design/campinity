/**
 * Account-scoped data this device keeps in local/session storage.
 *
 * Most of what the app stores locally is a DEVICE preference (theme, theme
 * pack, recent emojis, the push device id, notification-prompt choice) and
 * is deliberately kept across accounts. The keys below belong to whoever
 * was signed in — an unsent post draft, search history, onboarding/
 * verification-reminder flags, a pending email change — and must not leak
 * into the next account on the same phone or browser.
 *
 * syncAccountLocalData(uid) is called on every auth state change:
 *  - signed out (incl. Firebase signing a deleted/disabled account out
 *    when its token can no longer refresh) -> clear them;
 *  - a DIFFERENT account signs in than the one recorded last -> clear them;
 *  - the same account, or the first run of this code for an existing
 *    user (nothing recorded yet) -> keep everything.
 * Firestore keeps no on-disk cache in this app (memory cache only), so
 * there is nothing else to clear locally.
 */
const OWNER_KEY = 'campinity:lastAccountUid'

const LOCAL_KEYS = [
  'campinity:postDraft',
  'campinity:recentSearches',
  'campinity:mascotGreeted',
  'campinity_verification_modal_seen',
  'campinity_verification_banner_dismissed'
]
const LOCAL_PREFIXES = ['campinity:pendingEmailChange:']
const SESSION_KEYS = ['campinity:justOnboarded']
const SESSION_PREFIXES = ['campinity:verifyResendAt:']

function clearFrom(storage, keys, prefixes) {
  if (!storage) return
  keys.forEach((k) => storage.removeItem(k))
  const matches = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && prefixes.some((p) => k.startsWith(p))) matches.push(k)
  }
  matches.forEach((k) => storage.removeItem(k))
}

export function clearAccountLocalData() {
  try {
    clearFrom(window.localStorage, LOCAL_KEYS, LOCAL_PREFIXES)
  } catch {
    // storage unavailable (private mode / blocked) — nothing to clear
  }
  try {
    clearFrom(window.sessionStorage, SESSION_KEYS, SESSION_PREFIXES)
  } catch {
    // ignore
  }
}

export function syncAccountLocalData(uid) {
  let last = null
  try {
    last = window.localStorage.getItem(OWNER_KEY)
  } catch {
    return
  }
  if (!uid) {
    clearAccountLocalData()
    try {
      window.localStorage.removeItem(OWNER_KEY)
    } catch {
      // ignore
    }
    return
  }
  if (last && last !== uid) clearAccountLocalData()
  try {
    window.localStorage.setItem(OWNER_KEY, uid)
  } catch {
    // ignore
  }
}
