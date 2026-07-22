import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase.js'
import { getUserIdByUsername, ensureUsernameReservation } from './usernameService.js'

const COLLECTION = 'users'

/**
 * Fire-and-forget self-heal for the missing usernames/{username} bug:
 * if the signed-in user's own profile has a username but no confirmed
 * reservation yet, create it and mark it confirmed so this never runs
 * again for them. This is what makes the fix automatic and universal —
 * it runs from getUserProfile() itself, so ANY page that loads a user's
 * own profile (Home, Profile, Edit Profile, Create Post, Post Detail —
 * every one of them already calls getUserProfile on mount) triggers the
 * heal, with zero dependency on any specific onboarding/save code path
 * actually calling reserveUsername() correctly.
 *
 * Only ever heals the CURRENTLY SIGNED-IN user's own account — Firestore
 * rules require the reservation's uid field to match request.auth.uid,
 * so attempting this for someone else's profile would be rejected
 * anyway; the check here just avoids a wasted call.
 *
 * Never awaited by callers and never throws — a failure here must not
 * affect the profile read that triggered it.
 */
async function healUsernameReservation(uid, data) {
  if (!data?.username) return
  if (data.usernameReserved) return
  if (auth.currentUser?.uid !== uid) return

  const result = await ensureUsernameReservation(uid, data.username).catch(() => null)
  if (result?.ok) {
    await setDoc(doc(db, COLLECTION, uid), { usernameReserved: true }, { merge: true }).catch(() => null)
  }
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
 * Also triggers the username-reservation self-heal above as a
 * fire-and-forget side effect — see healUsernameReservation for why.
 *
 * Returns null if the document doesn't exist.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return null

  const data = snap.data()

  healUsernameReservation(uid, data)

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
      username: data.username ?? '',
      bio: data.bio ?? '',
      collegeId: data.collegeId ?? null,
      course: data.course ?? '',
      year: data.year ?? '',
      division: data.division ?? '',
      avatar: data.avatar ?? '',
      coverPhoto: data.coverPhoto ?? '',
      verifiedCampus: data.verifiedCampus ?? false,
      skills: Array.isArray(data.skills) ? data.skills : [],
      interests: Array.isArray(data.interests) ? data.interests : [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
}

/**
 * Updates only the provided fields on users/{uid}, stamping updatedAt.
 * Uses merge so it never clobbers fields owned by other features.
 */
export async function updateUserProfile(uid, data) {
  const ref = doc(db, COLLECTION, uid)
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
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