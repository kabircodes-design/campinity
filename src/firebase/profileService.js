import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase.js'
import { getUserIdByUsername, ensureUsernameReservation } from './usernameService.js'

const COLLECTION = 'users'

/**
 * Fire-and-forget self-heal, run once per user the first time this file
 * loads their own profile after this fix ships:
 *
 *  1. Missing usernames/{username} bug — if the profile has a username
 *     but no confirmed reservation yet, create it.
 *  2. Missing search-index fields — Firestore has no case-insensitive
 *     query, so student search (searchService.js) matches against
 *     lowercase mirror fields (displayNameLower, courseLower,
 *     yearLower). Existing profiles predate this and don't have them;
 *     this backfills them from the display-case fields already on the
 *     document. (username itself needs no mirror — usernameService.js
 *     already normalizes it to lowercase on every write.)
 *
 * Both run from getUserProfile() itself, so ANY page that loads a
 * user's own profile (Home, Profile, Edit Profile, Create Post, Post
 * Detail — all of them already call getUserProfile on mount) triggers
 * the heal, with zero dependency on any specific onboarding/save code
 * path doing the right thing. A single `searchIndexed` marker field
 * gates both checks so this never re-runs once healed.
 *
 * Only ever heals the CURRENTLY SIGNED-IN user's own account — Firestore
 * rules require the reservation's uid field to match request.auth.uid,
 * so attempting this for someone else's profile would be rejected
 * anyway; the check here just avoids a wasted call.
 *
 * Never awaited by callers and never throws — a failure here must not
 * affect the profile read that triggered it.
 */
async function healProfile(uid, data) {
  if (data?.searchIndexed) return
  if (auth.currentUser?.uid !== uid) return

  const updates = {}

  if (data?.username && !data.usernameReserved) {
    const result = await ensureUsernameReservation(uid, data.username).catch(() => null)
    if (result?.ok) updates.usernameReserved = true
  }

  const displayName = data?.displayName ?? data?.fullName ?? ''
  updates.displayNameLower = displayName.trim().toLowerCase()
  updates.courseLower = (data?.course || '').trim().toLowerCase()
  updates.yearLower = (data?.year || '').trim().toLowerCase()
  updates.searchIndexed = true

  await setDoc(doc(db, COLLECTION, uid), updates, { merge: true }).catch(() => null)
}

/**
 * Reads the users/{uid} profile document.
 *
 * Falls back to the field names written by the earlier onboarding flow
 * (fullName, photoURL — see src/auth/utils/userProfile.js) so profiles
 * created before this feature still load correctly. Every save from this
 * service writes the canonical field names below, so a document
 * self-migrates the first time a user edits their profile.
 *
 * Also triggers the self-heal above as a fire-and-forget side effect —
 * see healProfile for why.
 *
 * Returns null if the document doesn't exist.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return null

  const data = snap.data()

  healProfile(uid, data)

  return {
    displayName: data.displayName ?? data.fullName ?? '',
    username: data.username ?? '',
    bio: data.bio ?? '',
    collegeId: data.collegeId ?? null,
    course: data.course ?? '',
    year: data.year ?? '',
    division: data.division ?? '',
    avatar: data.avatar ?? data.photoURL ?? '',
    coverPhoto: data.coverPhoto ?? '',
    verifiedCampus: data.verifiedCampus ?? false,
    // Not part of the core schema for this feature, but already used by
    // the existing Edit Profile UI (Skills/Interests) — passed through so
    // that UI keeps working end-to-end.
    skills: Array.isArray(data.skills) ? data.skills : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null
  }
}

/**
 * Creates the users/{uid} document if it doesn't exist yet, with the
 * canonical profile fields. Uses merge so it never clobbers fields owned
 * by other features (role, verificationMethod, verificationStatus,
 * profileCompleted, email, uid — all set during onboarding).
 */
export async function createUserProfile(uid, data = {}) {
  const ref = doc(db, COLLECTION, uid)
  await setDoc(
    ref,
    {
      displayName: data.displayName ?? '',
      displayNameLower: (data.displayName ?? '').trim().toLowerCase(),
      username: data.username ?? '',
      bio: data.bio ?? '',
      collegeId: data.collegeId ?? null,
      course: data.course ?? '',
      courseLower: (data.course ?? '').trim().toLowerCase(),
      year: data.year ?? '',
      yearLower: (data.year ?? '').trim().toLowerCase(),
      division: data.division ?? '',
      avatar: data.avatar ?? '',
      coverPhoto: data.coverPhoto ?? '',
      verifiedCampus: data.verifiedCampus ?? false,
      skills: Array.isArray(data.skills) ? data.skills : [],
      interests: Array.isArray(data.interests) ? data.interests : [],
      searchIndexed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
}

/**
 * Updates only the provided fields on users/{uid}, stamping updatedAt.
 * Uses merge so it never clobbers fields owned by other features.
 *
 * Whenever displayName, course, or year is part of the update, their
 * lowercase search-index mirrors are recomputed and written in the same
 * call, so search stays in sync with the latest edit immediately rather
 * than waiting for the next self-heal read.
 */
export async function updateUserProfile(uid, data) {
  const ref = doc(db, COLLECTION, uid)
  const payload = { ...data, updatedAt: serverTimestamp() }

  if (typeof data.displayName === 'string') {
    payload.displayNameLower = data.displayName.trim().toLowerCase()
  }
  if (typeof data.course === 'string') {
    payload.courseLower = data.course.trim().toLowerCase()
  }
  if (typeof data.year === 'string') {
    payload.yearLower = data.year.trim().toLowerCase()
  }

  await setDoc(ref, payload, { merge: true })
}

/**
 * Resolves a username to its owner's full profile — the read path used
 * by the public Student Profile page (route param is :username, not
 * :uid). Returns null if the username isn't reserved or the profile
 * document doesn't exist. Also returns the resolved uid alongside the
 * profile fields, since callers need it (for the posts query, and for
 * detecting "is this my own profile").
 */
export async function getUserProfileByUsername(username) {
  const uid = await getUserIdByUsername(username)
  if (!uid) return null

  const profile = await getUserProfile(uid)
  if (!profile) return null

  return { uid, ...profile }
}