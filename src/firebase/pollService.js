import { collection, doc, getCountFromServer, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * Polls live on the post document itself (posts/{postId}.poll —
 * question/options, written once at createPost() time via the same
 * `extra` param collegeId/mentions/hashtags already use, no second
 * write path) plus a votes subcollection, posts/{postId}/pollVotes —
 * NOT a top-level `polls` collection and NOT a giant voterIds array on
 * the post. Deliberately no denormalized vote-count field on the post
 * either: maintaining "exactly one option's count +1, others
 * untouched" as a Firestore RULE (the actual enforcement point, since
 * this can't rely on a client-side-only tally) on a nested array field
 * is fragile to get right and easy to get subtly wrong. Real counts
 * are computed on demand via getCountFromServer — a lightweight
 * aggregation query (no document data transferred, just a number),
 * bounded to the poll's own small option list (2-6 queries), so this
 * is never a scan and never trusts anything the client claims.
 *
 * One vote per user is enforced at the RULES layer (see
 * firestore.rules' pollVotes/{uid} block): the vote doc's own id IS
 * the voter's uid, and the rule only ever allows create — never
 * update — so a second vote attempt is rejected outright, not just
 * hidden by this file's own logic.
 */

function pollVotesCollection(postId) {
  return collection(db, 'posts', postId, 'pollVotes')
}

function pollVoteDoc(postId, uid) {
  return doc(db, 'posts', postId, 'pollVotes', uid)
}

export async function votePoll(postId, uid, optionId) {
  if (!postId || !uid || !optionId) throw new Error('Missing vote details.')
  await setDoc(pollVoteDoc(postId, uid), { optionId, votedAt: serverTimestamp() })
}

/** Returns the optionId the viewer already voted for, or null if they haven't. */
export async function getMyPollVote(postId, uid) {
  if (!postId || !uid) return null
  const snap = await getDoc(pollVoteDoc(postId, uid))
  return snap.exists() ? snap.data().optionId : null
}

/** { [optionId]: count } — one bounded count() aggregation per option, real server-computed numbers. */
export async function getPollResults(postId, optionIds) {
  if (!postId || !Array.isArray(optionIds) || optionIds.length === 0) return {}
  const entries = await Promise.all(
    optionIds.map(async (optionId) => {
      const snap = await getCountFromServer(query(pollVotesCollection(postId), where('optionId', '==', optionId)))
      return [optionId, snap.data().count]
    })
  )
  return Object.fromEntries(entries)
}
