import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'

/**
 * Uploads the ID document to Storage first, then creates the
 * Firestore request record referencing only the Storage PATH — never
 * a public download URL, matching the explicit privacy requirement
 * ("do not store public download URLs in a user profile" extends
 * here too: nothing about this document should be casually
 * shareable). getDownloadURL() is deliberately never called for this
 * upload — reviewing admins fetch it on demand via
 * getVerificationDocumentUrl() below, gated by the Storage rule's own
 * owner-or-admin check, not by whether a URL happens to be floating
 * around in a Firestore field.
 */
export async function submitVerificationRequest({ uid, collegeId, file }) {
  if (!uid) throw new Error('You need to be signed in.')
  if (!file) throw new Error('Please choose your ID document.')

  const requestRef = doc(collection(db, 'verificationRequests'))
  const documentPath = `verificationDocuments/${uid}/${requestRef.id}/${Date.now()}-${file.name}`

  await uploadBytes(ref(storage, documentPath), file)

  await runTransaction(db, async (transaction) => {
    transaction.set(requestRef, {
      uid,
      collegeId: collegeId || null,
      status: 'pending',
      documentPath,
      createdAt: serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null
    })
  })

  return requestRef.id
}

/**
 * Admin-only in practice — see getPendingCollegeRequests' identical
 * reasoning in collegeRequestService.js: there is no client-readable
 * "am I an admin" signal, the query itself is rejected by Firestore
 * for a non-admin.
 */
export async function getPendingVerificationRequests() {
  const snap = await getDocs(query(collection(db, 'verificationRequests'), where('status', '==', 'pending')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Resolves a download URL for a specific document ON DEMAND, only
 * when an admin is actually reviewing it — never stored anywhere,
 * never attached to the request record itself. Storage's own rule
 * (owner-or-admin read) is the real gate; this function doesn't
 * duplicate that check client-side, the getDownloadURL call itself
 * will fail for an unauthorized caller.
 */
export async function getVerificationDocumentUrl(documentPath) {
  return getDownloadURL(ref(storage, documentPath))
}

/**
 * Approval writes to TWO documents — the request and the user's own
 * profile — inside one transaction, so a request can never end up
 * approved with the user still unverified, or vice versa. Both writes
 * are independently authorized by firestore.rules' own admin checks
 * (exists(platformAdmins/{uid})) — this function doesn't grant
 * anything itself, it just performs the writes the rules already
 * permit for a genuine admin and reject for anyone else.
 *
 * Rejection only touches the request — verifiedCampus is never
 * written at all for a rejection, matching "user remains unverified."
 */
export async function reviewVerificationRequest(requestId, decision, reviewerUid) {
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('Decision must be "approved" or "rejected".')
  }

  const requestRef = doc(db, 'verificationRequests', requestId)

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef)
    if (!requestSnap.exists()) throw new Error('This request no longer exists.')
    const requestData = requestSnap.data()

    if (requestData.status !== 'pending') {
      throw new Error(`This request was already ${requestData.status}.`)
    }

    if (decision === 'approved') {
      transaction.update(doc(db, 'users', requestData.uid), { verifiedCampus: true })
    }

    transaction.update(requestRef, {
      status: decision,
      reviewedBy: reviewerUid,
      reviewedAt: serverTimestamp()
    })
  })
}
