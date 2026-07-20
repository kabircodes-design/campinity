import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

const COLLECTION = 'users'

/**
 * Reads the users/{uid} profile document.
 *
 * Falls back to the field names written by the earlier onboarding flow
 * (fullName, photoURL — see src/auth/utils/userProfile.js) so profiles
 * created before this feature still load correctly. Every save from this
 * service writes the canonical field names below, so a document
 * self-migrates the first time a user edits their profile.
 *
 * Returns null if the document doesn't exist.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return null

  const data = snap.data()

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