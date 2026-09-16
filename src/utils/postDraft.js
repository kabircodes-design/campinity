const STORAGE_KEY = 'campinity:postDraft'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // a week-old draft is more likely stale than wanted back

/**
 * Text/simple-field draft only — never the actual image/PDF File
 * objects (those can't survive JSON/localStorage anyway; a restored
 * draft always needs its attachment re-selected, stated plainly in the
 * restore banner rather than silently losing it). Per-browser, per-
 * origin storage, never sent anywhere — matches "do not store draft
 * content in a shared/public Firestore document."
 */
export function savePostDraft({ text, category, isAnonymous }) {
  try {
    if (!text || !text.trim()) {
      clearPostDraft()
      return
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ text, category, isAnonymous, savedAt: Date.now() })
    )
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — the draft
    // just won't persist for this session, not a fatal error.
  }
}

/** Returns the saved draft, or null if there isn't one / it's expired / storage is unavailable. */
export function getPostDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.text || !parsed?.savedAt) return null
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearPostDraft()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPostDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do if storage itself is unavailable.
  }
}
