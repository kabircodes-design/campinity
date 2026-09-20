import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'

/**
 * Verified Campus Certificates — mirrors submitVerificationRequest's
 * exact privacy model (src/firebase/verificationService.js): the
 * uploaded file goes to a unique-per-submission Storage path, only its
 * `documentPath` is ever stored in Firestore, and getDownloadURL() is
 * never called client-side — a public/anyone-with-the-link URL is
 * never generated. Admin preview goes through the existing
 * adminGetVerificationDocumentUrl Cloud Function (Admin SDK), reused
 * unchanged since it already accepts an arbitrary documentPath.
 */

export const ACHIEVEMENT_CATEGORIES = ['Academic', 'Sports', 'Cultural', 'Competition', 'Leadership', 'Volunteering', 'Club', 'Other']

/**
 * The submission doc id is derived deterministically from
 * (title, issuer, year) rather than a random id — this is the actual
 * anti-farming mechanism (see functions/functions/index.js's comment
 * on the new Cloud Functions): firestore.rules only allows CREATE on
 * this subcollection, never update, so re-submitting the exact same
 * achievement a second time hits an "already exists" / permission
 * error instead of quietly creating a duplicate to farm review/reward.
 */
function slugifyForSubmissionId(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function submissionsCollection(uid) {
  return collection(db, 'users', uid, 'achievementSubmissions')
}

function verifiedCollection(uid) {
  return collection(db, 'users', uid, 'verifiedAchievements')
}

export function buildSubmissionId({ title, issuer, year }) {
  return `${slugifyForSubmissionId(title)}__${slugifyForSubmissionId(issuer)}__${year}`
}

/**
 * Submits a certificate for admin review. Throws a clear, expected
 * error (not a raw Firestore permission error) if the exact same
 * achievement was already submitted before — real anti-abuse, not a
 * client-side-only nicety, since firestore.rules independently
 * enforces the same create-only-once constraint.
 */
export async function submitAchievement({ uid, title, issuer, collegeId, category, year, description, file }) {
  if (!uid) throw new Error('You need to be signed in.')
  if (!title?.trim() || !issuer?.trim() || !year) {
    throw new Error('Title, issuer, and year are required.')
  }
  if (!file) throw new Error('Please attach your certificate.')

  const submissionId = buildSubmissionId({ title, issuer, year })
  const subRef = doc(submissionsCollection(uid), submissionId)

  const existing = await getDoc(subRef).catch(() => null)
  if (existing?.exists()) {
    throw new Error('You already submitted this exact achievement. Check its status in My Achievements.')
  }

  const documentPath = `achievementCertificates/${uid}/${submissionId}/${Date.now()}-${file.name}`
  await uploadBytes(ref(storage, documentPath), file)

  await setDoc(subRef, {
    userId: uid,
    title: title.trim(),
    issuer: issuer.trim(),
    collegeId: collegeId || null,
    category: category || 'Other',
    year: Number(year),
    description: (description || '').trim().slice(0, 500),
    documentPath,
    fileType: file.type || null,
    status: 'pending',
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null
  })

  return submissionId
}

export async function getMyAchievementSubmissions(uid) {
  const snap = await getDocs(query(submissionsCollection(uid), orderBy('submittedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getVerifiedAchievements(uid) {
  const snap = await getDocs(query(verifiedCollection(uid), orderBy('earnedAt', 'desc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export function subscribeToVerifiedAchievements(uid, callback) {
  return onSnapshot(query(verifiedCollection(uid), orderBy('earnedAt', 'desc')), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Marks a verified achievement as seen — the one field a user may ever touch on their own record (see firestore.rules), used by the achievement-unlock reveal toast. */
export async function markAchievementSeen(uid, achievementId) {
  await updateDoc(doc(verifiedCollection(uid), achievementId), { seen: true }).catch(() => {})
}
