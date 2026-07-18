import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/firebase'

/** Fetches the Firestore profile doc for a user. Returns null if it doesn't exist yet. */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

/**
 * Creates the initial users/{uid} doc immediately after signup — before
 * the user has verified their email or completed onboarding. Role is
 * prepared for future admin/moderator tooling per the Firestore structure
 * spec, even though only "student" is assignable from this app today.
 */
export async function createInitialUserDoc(uid, email) {
  await setDoc(
    doc(db, 'users', uid),
    {
    uid,
    email: email || '',
    role: 'student',
    verifiedCampus: false,
    verificationMethod: '',
    verificationStatus: 'not_started',
    profileCompleted: false,
    createdAt: serverTimestamp()
  },
  { merge: true }
  ) 
}

/** Merges new fields into an existing users/{uid} doc without touching the rest. */
export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true })
}

/** Records the outcome of the campus verification step (email, ID card, or skip). */
export async function setCampusVerification(uid, { verifiedCampus, verificationMethod, verificationStatus }) {
  await saveUserProfile(uid, { verifiedCampus, verificationMethod, verificationStatus })
}

/**
 * Logs a college-ID submission into verificationRequests for future
 * manual/admin review. Structure only — no review UI exists yet.
 */
export async function createVerificationRequest({ uid, name, college, idCardUrl, verificationMethod }) {
  await addDoc(collection(db, 'verificationRequests'), {
    uid,
    name: name || '',
    college: college || '',
    idCardUrl,
    verificationMethod,
    status: 'pending',
    submittedAt: serverTimestamp()
  })
}

/**
 * Ensures a users/{uid} doc exists for a Google sign-in (which skips the
 * normal email/password signup path where the doc is usually created
 * first). Returns the existing profile, or null for a brand-new doc —
 * resolveOnboardingRoute() in ProtectedRoute.jsx treats null the same as
 * a fresh "not_started" doc, so callers don't need to special-case it.
 */
export async function ensureUserDoc(user) {
  const existing = await getUserProfile(user.uid)
  if (!existing) {
    await createInitialUserDoc(user.uid, user.email)
    return null
  }
  return existing
}