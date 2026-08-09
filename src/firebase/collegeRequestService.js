import { collection, doc, getDoc, getDocs, query, runTransaction, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { slugifyCollegeName, parseLocation } from '../data/dummyColleges.js'

/**
 * Admin status has no client-readable signal — platformAdmins/{uid}
 * is deliberately locked to `if false` for every client operation
 * (see firestore.rules), so there is no getDoc() call that can ever
 * confirm "am I an admin" in advance. The query below IS the
 * authorization check. A non-admin's query is rejected by Firestore
 * itself (permission-denied), which the caller should treat as "you
 * don't have access."
 */
export async function getPendingCollegeRequests() {
  const snap = await getDocs(query(collection(db, 'collegeRequests'), where('status', '==', 'pending')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Approval now performs the real, complete flow — not a status-only
 * update. Both writes (the new/existing college document, and the
 * request's status) happen inside one transaction: either both
 * succeed or neither does, so a request can never end up "approved"
 * with no corresponding college, or a college created with no record
 * of which request produced it.
 *
 * Duplicate protection, concretely: the college's Firestore doc id is
 * a deterministic slug of its name (slugifyCollegeName). Approving
 * "Thakur College of Science and Commerce" always resolves to
 * "thakur-college-science-commerce" — the exact id already used by
 * the real, existing document for that college (confirmed directly,
 * not assumed). The transaction reads that doc first: if it already
 * exists, this approval REFERENCES it rather than creating a second
 * one — the existing verified record is never overwritten, its
 * `verified` value is preserved exactly as it already is.
 *
 * Security, stated precisely: this function does not and cannot
 * verify admin status itself — the actual verification is
 * firestore.rules' own exists(platformAdmins/{uid}) check, evaluated
 * server-side on both writes independently. A non-admin calling this
 * function gets a real Firestore permission-denied error, not a
 * client-side illusion of a check.
 */
export async function reviewCollegeRequest(requestId, decision) {
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('Decision must be "approved" or "rejected".')
  }

  const requestRef = doc(db, 'collegeRequests', requestId)

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef)
    if (!requestSnap.exists()) throw new Error('This request no longer exists.')
    const requestData = requestSnap.data()

    if (requestData.status !== 'pending') {
      throw new Error(`This request was already ${requestData.status}.`)
    }

    if (decision === 'approved') {
      const slug = slugifyCollegeName(requestData.name)
      const collegeRef = doc(db, 'colleges', slug)
      const existingCollege = await transaction.get(collegeRef)

      if (!existingCollege.exists()) {
        const { city, state } = parseLocation(requestData.location)
        transaction.set(collegeRef, {
          name: requestData.name,
          nameLower: requestData.name.trim().toLowerCase(),
          city,
          cityLower: city.toLowerCase(),
          state,
          stateLower: state.toLowerCase(),
          verified: false
        })
      }
      // If it already exists, deliberately no write here at all — the
      // existing document (its verified status included) is left
      // completely untouched, matching "must NOT be deleted, renamed,
      // overwritten, or duplicated."
    }

    transaction.update(requestRef, { status: decision })
  })
}
