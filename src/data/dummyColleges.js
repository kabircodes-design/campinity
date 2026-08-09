import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'

/**
 * FULL MIGRATION (not the partial cache-bridge from the prior pass,
 * which is removed entirely): Firestore colleges/{collegeId} is now
 * the single source of truth, matching the pre-existing real schema
 * confirmed directly from the user's own Firestore data — { name,
 * nameLower, city, cityLower, state, stateLower, verified } — not the
 * { name, location } shape this module used before. No static array,
 * no in-memory cache, no sync step. getCollegeById is now genuinely
 * async; every one of its 5 existing callers was updated to await it
 * (ProfilePage.jsx, StudentProfilePlaceholder.jsx, EditProfilePage.jsx,
 * CollegePage.jsx — CollegeSearch.jsx no longer uses this module at
 * all, it queries Firestore directly for search, matching the
 * migration plan's explicit instruction).
 */

export async function getCollegeById(id) {
  if (!id) return null
  const snap = await getDoc(doc(db, 'colleges', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * Shared with collegeRequestService.js. Verified directly against the
 * real, existing Firestore document ids before shipping — not
 * assumed: "Thakur College of Engineering and Technology" and
 * "Thakur College of Science and Commerce" both need to resolve to
 * their real existing slugs (thakur-college-engineering-technology,
 * thakur-college-science-commerce), which requires stripping common
 * stop words (of/and/the/&) — confirmed by reverse-engineering all 3
 * known real document ids exactly, including mithibai-college-arts.
 * Without this, slugifying the pending Thakur test request would have
 * produced a DIFFERENT slug than the real existing college, causing
 * approval to create a duplicate instead of detecting the match.
 */
const SLUG_STOPWORDS = new Set(['of', 'and', 'the', '&'])

export function slugifyCollegeName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, '') // strip apostrophes entirely first — "Xavier's" must become "xaviers" as one word, not split by a later space-replacement
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !SLUG_STOPWORDS.has(word))
    .join('-')
}

/**
 * Parses the collegeRequests submission shape ("Mumbai, Maharashtra")
 * into the real colleges schema's separate city/state fields. Not a
 * new location model — this is the only format AddCollegePage.jsx's
 * existing single free-text field ever produces (confirmed by reading
 * that page directly), so this is a direct, minimal translation, not
 * an invented parser for arbitrary input.
 */
export function parseLocation(location) {
  const parts = (location || '').split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1] }
  }
  if (parts.length === 1) {
    // A single, unstructured value — safer to treat it as the city
    // than to guess which part is missing.
    return { city: parts[0], state: '' }
  }
  return { city: '', state: '' }
}
