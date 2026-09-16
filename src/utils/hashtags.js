/**
 * Pure text utility, no Firebase dependency — reused by both the post
 * composer (extracting what to store) and postService.js's search
 * (normalizing what to query against), so the two can never drift out
 * of sync on what counts as "the same hashtag."
 */
const HASHTAG_PATTERN = /#([a-zA-Z0-9_]+)/g

/** Lowercase, de-duplicated, in first-appearance order. Capped at 10 — a post isn't a tag-spam vector. */
export function extractHashtags(text) {
  if (!text) return []
  const matches = text.match(HASHTAG_PATTERN) || []
  const normalized = matches.map((m) => m.slice(1).toLowerCase())
  return Array.from(new Set(normalized)).slice(0, 10)
}

export function normalizeHashtag(tag) {
  return (tag || '').trim().replace(/^#/, '').toLowerCase()
}
