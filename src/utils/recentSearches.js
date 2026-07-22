const STORAGE_KEY = 'campinity:recentSearches'
const MAX_ITEMS = 10

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage unavailable (private browsing, quota, etc.) — fail silently,
    // recent searches just won't persist for this session.
  }
}

/** Returns saved recent searches, newest first. */
export function getRecentSearches() {
  return readAll()
}

/**
 * Adds a search term to the front of the list. A duplicate (case- and
 * whitespace-insensitive) is moved to the top instead of being added
 * again. List is capped at 10 items, oldest dropped first.
 */
export function addRecentSearch(term) {
  const trimmed = (term || '').trim()
  if (!trimmed) return getRecentSearches()

  const existing = readAll()
  const withoutDuplicate = existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())
  const next = [trimmed, ...withoutDuplicate].slice(0, MAX_ITEMS)

  writeAll(next)
  return next
}

/** Removes a single term from the saved list. */
export function removeRecentSearch(term) {
  const next = readAll().filter((item) => item !== term)
  writeAll(next)
  return next
}

/** Clears all saved recent searches. */
export function clearRecentSearches() {
  writeAll([])
  return []
}