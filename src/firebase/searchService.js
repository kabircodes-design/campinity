import { collection, getDocs, limit, orderBy, query, startAt, endAt, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { searchColleges, getCollegeById } from './collegeService.js'
import { getAvatarColor, getInitials } from './postService.js'

const USERS_COLLECTION = 'users'
const RESULTS_PER_FIELD = 8
const MAX_COLLEGE_EXPANSION = 5
const MAX_STUDENTS_PER_COLLEGE = 8

function toLower(value = '') {
  return value.trim().toLowerCase()
}

/**
 * ROOT-CAUSE FIX for search results always showing the generic
 * "Student" fallback: this function computed the display name
 * correctly (with a real displayName/fullName fallback chain) but
 * returned it under the key `name` — StudentCard.jsx (the actual
 * rendered card for every search result) reads `student.displayName`,
 * which was therefore always `undefined`, firing StudentCard's own
 * `'Student'` fallback unconditionally regardless of data quality.
 * Fixed by returning it under the key the card actually reads.
 *
 * Also now carries collegeId/college/division/rollNumber — previously
 * dropped entirely even though they're real, already-stored profile
 * fields, which is the other half of why results looked generic: the
 * card had nothing but a name/username/course/year to show.
 */
function mapUserDoc(docSnap) {
  const data = docSnap.data()
  const displayName = data.displayName || data.fullName || ''

  return {
    uid: docSnap.id,
    displayName,
    username: data.username || '',
    course: data.course || '',
    year: data.year || '',
    division: data.division || '',
    rollNumber: data.rollNumber || '',
    collegeId: data.collegeId || null,
    college: data.college || '',
    avatar: data.avatar || data.photoURL || '',
    initials: getInitials(displayName),
    colorClass: getAvatarColor(docSnap.id),
    // Additive — existing callers (the real Search page) simply don't
    // read these two; added for AdminUserVerificationPage.jsx's real
    // user-lookup + verification-status view, reusing this search
    // instead of a second one.
    verifiedCampus: Boolean(data.verifiedCampus),
    moderationStatus: data.moderationStatus || null
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
 * Searches students by username, displayName, course, year, division,
 * or roll number — case-insensitive prefix match, merged and
 * de-duplicated across all six fields. Each is still a genuine
 * server-side Firestore range query (Firestore can't OR across fields
 * in one query), not a broad fetch-then-filter — this is the same
 * "extend the existing index strategy" approach the original four-field
 * version already used, just with two more real fields added.
 *
 * `username` is queried directly (usernameService.js already normalizes
 * every username to lowercase on write, so it needs no mirror field).
 * `displayName`, `course`, `year`, `division`, and `rollNumber` are
 * queried against their lowercase mirror fields — see
 * profileService.js's buildSearchIndexFields()/healProfile() for how
 * those mirrors are kept in sync, and CreateProfilePage/EditProfilePage
 * for where they're populated. Each field query is independently capped
 * at RESULTS_PER_FIELD so a broad single-letter query (e.g. "S") can't
 * balloon into an unbounded read.
 */
/**
 * A division search should work regardless of whether the searcher
 * types the hyphen the canonical stored value requires — "S3" and
 * "S-3" are the same division to a human. This never touches the
 * stored/canonical `division` value (still validated/normalized at
 * save time in profileValidation.js to always require the hyphen for
 * a letter+number division) — it only ever produces a second SEARCH
 * candidate string, and only for the one unambiguous case: letters
 * directly followed by digits with no separator, or letters-hyphen-
 * digits. "s3" <-> "s-3" is a deterministic, one-to-one toggle; there's
 * no other reasonable reading of either form, so this can't misfire
 * into matching some other division by accident.
 */
function divisionHyphenVariant(prefix) {
  const noHyphen = /^([a-z]+)(\d+)$/i.exec(prefix)
  if (noHyphen) return `${noHyphen[1]}-${noHyphen[2]}`.toLowerCase()
  const withHyphen = /^([a-z]+)-(\d+)$/i.exec(prefix)
  if (withHyphen) return `${withHyphen[1]}${withHyphen[2]}`.toLowerCase()
  return null
}

export async function searchStudents(rawQuery) {
  const prefix = toLower(rawQuery)
  if (!prefix) return []

  const divisionVariant = divisionHyphenVariant(prefix)

  const [byUsername, byDisplayName, byCourse, byYear, byDivision, byDivisionVariant, byRollNumber] = await Promise.all([
    prefixSearchUsers('username', prefix),
    prefixSearchUsers('displayNameLower', prefix),
    prefixSearchUsers('courseLower', prefix),
    prefixSearchUsers('yearLower', prefix),
    prefixSearchUsers('divisionLower', prefix),
    divisionVariant ? prefixSearchUsers('divisionLower', divisionVariant) : Promise.resolve([]),
    prefixSearchUsers('rollNumberLower', prefix)
  ])

  const merged = new Map()
  for (const student of [...byUsername, ...byDisplayName, ...byCourse, ...byYear, ...byDivision, ...byDivisionVariant, ...byRollNumber]) {
    merged.set(student.uid, student)
  }
  return Array.from(merged.values())
}

/** Every student belonging to one college — how a college-name match (e.g. "Thakur") expands into real people, not just a college result. */
async function getStudentsByCollegeId(collegeId, limitN = MAX_STUDENTS_PER_COLLEGE) {
  if (!collegeId) return []
  const usersQuery = query(collection(db, USERS_COLLECTION), where('collegeId', '==', collegeId), limit(limitN))
  const snap = await getDocs(usersQuery)
  return snap.docs.map(mapUserDoc)
}

/**
 * Backfills a missing `college` display name from `collegeId` for
 * results that predate this pass's college denormalization (existing
 * users who set a college via Edit Profile before `college` was also
 * written alongside `collegeId`, or old free-text onboarding data with
 * no collegeId at all — those simply stay blank, not fabricated).
 * Batched and deduped by collegeId so a page of results with several
 * students from the same college only fetches that college once.
 */
async function enrichMissingCollegeNames(students) {
  const missingIds = [...new Set(students.filter((s) => !s.college && s.collegeId).map((s) => s.collegeId))]
  if (missingIds.length === 0) return students

  const nameById = new Map()
  await Promise.all(
    missingIds.map(async (id) => {
      const college = await getCollegeById(id).catch(() => null)
      if (college?.name) nameById.set(id, college.name)
    })
  )
  if (nameById.size === 0) return students

  return students.map((s) => (!s.college && nameById.has(s.collegeId) ? { ...s, college: nameById.get(s.collegeId) } : s))
}

/**
 * Real relevance ranking — not popularity/XP/reputation-based (the
 * brief is explicit that search relevance, not social ranking, is the
 * priority). Roughly follows the brief's stated priority order: exact
 * username > exact roll number > strong name match > exact college/
 * class/division match > partial matches. A student can qualify under
 * multiple fields; only the single highest-scoring match determines
 * its position.
 */
function scoreStudent(student, normalizedQuery) {
  const usernameLower = toLower(student.username)
  const nameLower = toLower(student.displayName)
  const rollLower = toLower(student.rollNumber)
  const divisionLower = toLower(student.division)
  const courseLower = toLower(student.course)
  const yearLower = toLower(student.year)
  const collegeLower = toLower(student.college)

  let score = 0
  if (usernameLower === normalizedQuery) score = Math.max(score, 100)
  else if (usernameLower.startsWith(normalizedQuery)) score = Math.max(score, 80)

  if (rollLower && rollLower === normalizedQuery) score = Math.max(score, 95)
  else if (rollLower.startsWith(normalizedQuery)) score = Math.max(score, 62)

  if (nameLower === normalizedQuery) score = Math.max(score, 90)
  else if (nameLower.startsWith(normalizedQuery)) score = Math.max(score, 78)

  const divisionVariant = divisionHyphenVariant(normalizedQuery)
  if (divisionLower === normalizedQuery) score = Math.max(score, 68)
  // Slightly lower than a literal exact match — this is a fuzzy
  // "s3 also means s-3" match, still a real, deliberate match, just
  // not what the user typed character-for-character.
  else if (divisionVariant && divisionLower === divisionVariant) score = Math.max(score, 63)
  if (courseLower === normalizedQuery) score = Math.max(score, 66)
  else if (courseLower.startsWith(normalizedQuery)) score = Math.max(score, 50)
  if (yearLower === normalizedQuery) score = Math.max(score, 64)

  if (collegeLower.includes(normalizedQuery)) score = Math.max(score, 42)

  return score
}

function rankStudents(students, rawQuery) {
  const normalizedQuery = toLower(rawQuery)
  return [...students].sort((a, b) => scoreStudent(b, normalizedQuery) - scoreStudent(a, normalizedQuery))
}

/**
 * Searches both students and colleges in parallel — the single entry
 * point the Search page actually calls. Reuses collegeService.js's
 * existing searchColleges() rather than duplicating college search
 * logic here.
 *
 * College-name matches are expanded into real student results too
 * (bounded to the top MAX_COLLEGE_EXPANSION matched colleges, each
 * contributing up to MAX_STUDENTS_PER_COLLEGE students) — searching
 * "Thakur" should surface people who study there, not just the college
 * record itself, per the brief's explicit example.
 */
export async function searchAll(rawQuery) {
  const [students, colleges] = await Promise.all([searchStudents(rawQuery), searchColleges(rawQuery)])

  const merged = new Map(students.map((s) => [s.uid, s]))
  const collegeExpansions = await Promise.all(
    colleges.slice(0, MAX_COLLEGE_EXPANSION).map((college) => getStudentsByCollegeId(college.id))
  )
  for (const list of collegeExpansions) {
    for (const student of list) {
      if (!merged.has(student.uid)) merged.set(student.uid, student)
    }
  }

  const enriched = await enrichMissingCollegeNames(Array.from(merged.values()))
  return { students: rankStudents(enriched, rawQuery), colleges }
}

/**
 * "People from your course" — a browsable discovery query, distinct
 * from searchStudents() above (which needs a typed prefix). Real,
 * server-side, exact-match compound query on the same courseLower
 * mirror field searchStudents already relies on — no new profile
 * field. "Department" isn't tracked separately anywhere in this app
 * (EditProfilePage.jsx's own Department input writes into this exact
 * `course` field), so this single query already covers both concepts.
 *
 * Two equality filters on different fields (collegeId + courseLower)
 * requires a Firestore composite index — same one-time-setup situation
 * postService.js's getFeedPosts already documents: the first real run
 * against production will surface a console link to create it, which
 * can't be done from application code.
 */
export async function getPeopleFromMyCourse(collegeId, course, { excludeUid = null, pageSize = 12 } = {}) {
  const courseLower = toLower(course)
  if (!collegeId || !courseLower) return []
  const usersQuery = query(
    collection(db, USERS_COLLECTION),
    where('collegeId', '==', collegeId),
    where('courseLower', '==', courseLower),
    limit(pageSize + (excludeUid ? 1 : 0))
  )
  const snap = await getDocs(usersQuery)
  return snap.docs.map(mapUserDoc).filter((u) => u.uid !== excludeUid).slice(0, pageSize)
}