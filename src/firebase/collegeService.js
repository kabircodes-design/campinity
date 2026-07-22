import { collection, doc, endAt, getDoc, getDocs, limit, orderBy, query, startAt } from 'firebase/firestore'
import { db } from './firebase.js'

const COLLECTION = 'colleges'
const RESULTS_PER_FIELD = 8

function toLower(value = '') {
  return value.trim().toLowerCase()
}

function mapCollegeDoc(docSnap) {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    name: data.name || '',
    city: data.city || '',
    state: data.state || '',
    verified: data.verified === true
  }
}

/**
 * A single case-insensitive prefix search against one lowercase field —
 * the standard Firestore pattern for "starts with", using the
 * Unicode-incremented upper bound ('\uf8ff') as the range's exclusive
 * end. Needs only Firestore's automatic single-field index on `field`.
 */
async function prefixSearch(field, prefix) {
  const collegesQuery = query(
    collection(db, COLLECTION),
    orderBy(field),
    startAt(prefix),
    endAt(`${prefix}\uf8ff`),
    limit(RESULTS_PER_FIELD)
  )
  const snap = await getDocs(collegesQuery)
  return snap.docs.map(mapCollegeDoc)
}

/**
 * Searches colleges by name, city, or state — case-insensitive prefix
 * match, merged and de-duplicated across all three fields.
 *
 * REQUIRES each colleges/{id} document to also store lowercase mirror
 * fields: nameLower, cityLower, stateLower (alongside the display-case
 * name/city/state). Firestore range queries compare raw Unicode code
 * points, so case-insensitive prefix search isn't possible against the
 * display-case fields directly — this is the indexable way to do it at
 * any scale without standing up a dedicated search service.
 */
export async function searchColleges(rawQuery) {
  const prefix = toLower(rawQuery)
  if (!prefix) return []

  const [byName, byCity, byState] = await Promise.all([
    prefixSearch('nameLower', prefix),
    prefixSearch('cityLower', prefix),
    prefixSearch('stateLower', prefix)
  ])

  const merged = new Map()
  for (const college of [...byName, ...byCity, ...byState]) {
    merged.set(college.id, college)
  }
  return Array.from(merged.values())
}

/**
 * Fetches a single college by its document id. Returns null if it
 * doesn't exist.
 */
export async function getCollegeById(id) {
  if (!id) return null
  const snap = await getDoc(doc(db, COLLECTION, id))
  return snap.exists() ? mapCollegeDoc(snap) : null
}