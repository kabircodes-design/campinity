import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase.js'

const POSTS_COLLECTION = 'posts'
const COMMENTS_SUBCOLLECTION = 'comments'

/**
 * Toggle-like core. Reads the post, checks whether `uid` is already in
 * `likedBy`, and only applies the array change + counter change if the
 * requested state actually differs from the current one. This is what
 * makes double-clicks/retries safe and keeps likesCount from ever
 * drifting away from likedBy.length — arrayUnion()+increment() alone
 * can't express "only increment if this uid wasn't already present,"
 * so this runs as a transaction rather than a plain updateDoc.
 */
async function setLikeState(postId, uid, shouldBeLiked) {
  const postRef = doc(db, POSTS_COLLECTION, postId)

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(postRef)
    if (!snap.exists()) return

    const data = snap.data()
    const likedBy = Array.isArray(data.likedBy) ? data.likedBy : []
    const alreadyLiked = likedBy.includes(uid)

    if (alreadyLiked === shouldBeLiked) return // already in the requested state — no-op

    const nextLikedBy = shouldBeLiked ? [...likedBy, uid] : likedBy.filter((id) => id !== uid)
    const nextCount = Math.max((data.likesCount || 0) + (shouldBeLiked ? 1 : -1), 0)

    transaction.update(postRef, { likedBy: nextLikedBy, likesCount: nextCount })
  })
}

/** Likes a post on behalf of `uid`. Safe to call even if already liked. */
export async function likePost(postId, uid) {
  await setLikeState(postId, uid, true)
}

/** Unlikes a post on behalf of `uid`. Safe to call even if not liked. */
export async function unlikePost(postId, uid) {
  await setLikeState(postId, uid, false)
}

/**
 * Returns the list of uids who liked a post. Reads the post doc itself —
 * likedBy already lives there, so this never issues a second query.
 */
export async function getPostLikes(postId) {
  const snap = await getDoc(doc(db, POSTS_COLLECTION, postId))
  if (!snap.exists()) return []
  const data = snap.data()
  return Array.isArray(data.likedBy) ? data.likedBy : []
}

/**
 * Reads a post's comments, oldest first (matches the existing comment
 * thread's display order).
 */
export async function getComments(postId) {
  const commentsQuery = query(
    collection(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(commentsQuery)
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
}

/**
 * Adds a comment to a post and increments the post's cached
 * commentsCount in the same batch. No read-then-write precondition is
 * needed here (every call is a genuine new comment), so increment()
 * inside a batch is sufficient — no transaction required.
 */
export async function addComment(postId, { uid, displayName, username, text }) {
  const postRef = doc(db, POSTS_COLLECTION, postId)
  const commentRef = doc(collection(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION))

  const batch = writeBatch(db)
  batch.set(commentRef, {
    userId: uid,
    displayName: displayName || '',
    username: username || '',
    text,
    createdAt: serverTimestamp()
  })
  batch.update(postRef, { commentsCount: increment(1) })
  await batch.commit()

  return commentRef.id
}

/**
 * Deletes a comment and decrements the post's commentsCount in the same
 * batch. `requestingUid` is checked client-side as a fast-fail — the
 * actual enforcement is Firestore rules (only the comment's own author
 * may delete it); this just avoids a round trip for an action the rules
 * would reject anyway.
 */
export async function deleteComment(postId, commentId, requestingUid) {
  const postRef = doc(db, POSTS_COLLECTION, postId)
  const commentRef = doc(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION, commentId)

  const commentSnap = await getDoc(commentRef)
  if (!commentSnap.exists()) return
  if (commentSnap.data().userId !== requestingUid) {
    const err = new Error('You can only delete your own comments')
    err.code = 'not-comment-owner'
    throw err
  }

  const batch = writeBatch(db)
  batch.delete(commentRef)
  batch.update(postRef, { commentsCount: increment(-1) })
  await batch.commit()
}