import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Admin-only, enforced server-side by firestore.rules on every write
 * this function performs — this function itself grants nothing, it
 * just performs the writes the rules already permit for a real admin
 * and reject for anyone else.
 *
 * One transaction updates the report AND (if applicable) sets the
 * target user's moderationStatus, so a report can never end up
 * "resolved" with a promised action that silently didn't happen.
 * Content removal (posts/comments/stories) is deliberately NOT done
 * inside this same transaction — those are top-level/subcollection
 * documents in different locations per targetType, and Firestore
 * transactions here are simplest kept to the two documents that are
 * always involved (the report + the target user). The admin UI calls
 * the existing deletePost/deleteComment/deleteStory functions
 * separately for "Remove content," now unlocked for admins via the
 * rules extension in firestore.rules.
 */
export async function reviewReport({ reportId, adminUid, decision, moderationStatus, targetOwnerUid }) {
  if (!reportId || !adminUid) throw new Error('Missing report or reviewer.')

  await runTransaction(db, async (transaction) => {
    const reportRef = doc(db, 'reports', reportId)
    const reportSnap = await transaction.get(reportRef)
    if (!reportSnap.exists()) throw new Error('This report no longer exists.')
    if (reportSnap.data().status !== 'pending') {
      throw new Error(`This report was already ${reportSnap.data().status}.`)
    }

    if (moderationStatus && targetOwnerUid) {
      transaction.update(doc(db, 'users', targetOwnerUid), { moderationStatus })
    }

    transaction.update(reportRef, {
      status: decision,
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
      moderationAction: moderationStatus || decision
    })
  })

  await logModerationAction({
    adminUid,
    action: moderationStatus || decision,
    targetType: 'report',
    targetId: reportId,
    targetUid: targetOwnerUid || null,
    reportId
  })
}

/**
 * Append-only audit trail — matches firestore.rules exactly (create
 * admin-only with adminUid self-attestation, update/delete always
 * false). Called after every moderation decision.
 */
export async function logModerationAction({ adminUid, action, targetType, targetId, targetUid, reportId, reason }) {
  await addDoc(collection(db, 'moderationActions'), {
    adminUid,
    action,
    targetType: targetType || null,
    targetId: targetId || null,
    targetUid: targetUid || null,
    reportId: reportId || null,
    reason: reason || null,
    createdAt: serverTimestamp()
  })
}
