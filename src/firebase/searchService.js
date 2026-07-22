import { collection, getDocs, limit, orderBy, query, startAt, endAt } from 'firebase/firestore'
import { db } from './firebase.js'
import { searchColleges } from './collegeService.js'
import { getAvatarColor, getInitials } from './postService.js'

const USERS_COLLECTION = 'users'
const RESULTS_PER_FIELD = 8

function toLower(value = '') {
  return value.trim().toLowerCase()
}

function mapUserDoc(docSnap) {
  const data = docSnap.data()
  const displayName = data.displayName || data.fullName || ''

  return {
    uid: docSnap.id,
    name: displayName,
    username: data.username || '',
    course: data.course || '',
    year: data.year || '',
    avatar: data.avatar || data.photoURL || '',
    initials: getInitials(displayName),
    colorClass: getAvatarColor(docSnap.id)
  }
}

/**
 * A single case-insensitive prefix search against one lowercase field —
 * same pattern as collegeService.js's prefixSearch. Needs only
 * Firestore's automatic single-field index on `field`.
 */
async function prefixSearchUsers(field, prefix) {
  const usersQuery = query(
    collection(db, USERS_COLLECTION),
    orderBy(field),
    startAt(prefix),
    endAt(`${prefix}\uf8ff`),
    limit(RESULTS_PER_FIELD)
  )
  const snap = await getDocs(usersQuery)
  return snap.docs.map(mapUserDoc)
}

/**
 * Searches students by username, displayName, course, or year —
 * case-insensitive prefix match, merged and de-duplicated across all
 * four fields.
 *
 * `username` is queried directly (usernameService.js already normalizes
 * every username to lowercase on write, so it needs no mirror field).
 * `displayName`, `course`, and `year` are queried against their
 * lowercase mirror fields (displayNameLower, courseLower, yearLower) —
 * see profileService.js's healProfile()/createUserProfile()/
 * updateUserProfile() for how those mirrors are kept in sync.
 */
export async function searchStudents(rawQuery) {
  const prefix = toLower(rawQuery)
  if (!prefix) return []

  const [byUsername, byDisplayName, byCourse, byYear] = await Promise.all([
    prefixSearchUsers('username', prefix),
    prefixSearchUsers('displayNameLower', prefix),
    prefixSearchUsers('courseLower', prefix),
    prefixSearchUsers('yearLower', prefix)
  ])

  const merged = new Map()
  for (const student of [...byUsername, ...byDisplayName, ...byCourse, ...byYear]) {
    merged.set(student.uid, student)
  }
  return Array.from(merged.values())
}

/**
 * Searches both students and colleges in parallel — the single entry
 * point the Search page actually calls. Reuses collegeService.js's
 * existing searchColleges() rather than duplicating college search
 * logic here.
 */
export async function searchAll(rawQuery) {
  const [students, colleges] = await Promise.all([searchStudents(rawQuery), searchColleges(rawQuery)])
  return { students, colleges }
}