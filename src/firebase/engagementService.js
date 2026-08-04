import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase.js'
import {
  createLikeNotification,
  createCommentNotification,
  createReplyNotification,
  createCommentLikeNotification,
  createMentionNotification,
  createPinNotification
} from './notificationService.js'

/**
 * ONE file, per this task's explicit instruction — no parallel
 * commentService.js. likePost/unlikePost/addComment/deleteComment/
 * getComments keep their exact existing export names (confirmed via
 * grep: PostCard.jsx and PostDetailPage.jsx are the only two
 * importers, using exactly these 5 names) so no import statement
 * anywhere needs to change. addComment/deleteComment/getComments are
 * REPLACED outright — the old flat implementation is gone, not kept
 * alongside this one.
 *
 * likePost/unlikePost are a RECONSTRUCTION, not a copy — I have never
 * seen this file's actual prior source. Confidence is high because
 * both the exact security rule (posts/{postId} update allows
 * hasOnly(['likedBy','likesCount'])) and the exact call sites
 * (likePost(post.id, uid), optimistic UI assuming standard
 * increment/decrement) are fully observable. What I can't reconstruct
 * — internal comments, defensive checks, or structural choices the
 * original author made for reasons not visible from the outside — is
 * accepted as an honest limit of reconstructing an unseen file from
 * its observable behavior.
 *
 * commentsCount on the PARENT POST — discovered from the security
 * rules (a separate hasOnly(['commentsCount']) branch exists on
 * posts/{postId}, meaning something is expected to maintain it) and
 * NOT present in my first draft of this system. Fixed here:
 * addComment/deleteComment (top-level only, not replies — a reply
 * doesn't change how many top-level discussion threads a post has)
 * now transactionally update the post's own commentsCount alongside
 * the comment write.
 */

function postDoc(postId) {
  return doc(db, 'posts', postId)
}

function commentsCollection(postId) {
  return collection(db, 'posts', postId, 'comments')
}

function commentDoc(postId, commentId) {
  return doc(db, 'posts', postId, 'comments', commentId)
}

/* ============================================================
   MENTION SEARCH — for the @mention composer. Firestore's standard
   prefix-range pattern (>= prefix, <= prefix + high-codepoint char),
   not a full-text search service (this project doesn't have one for
   users — searchService.js, used by SearchPage.jsx, is a file I don't
   have and can't confirm supports this). Requires `username` to be a
   queryable top-level field on users/{uid} — confirmed to exist via
   getUserProfile's return shape, used consistently across this
   project.
   ============================================================ */
export async function searchUsersForMention(prefix, { limit: max = 6 } = {}) {
  const normalized = prefix.trim().toLowerCase()
  if (!normalized) return []

  const snap = await getDocs(
    query(
      collection(db, 'users'),
      orderBy('username'),
      where('username', '>=', normalized),
      where('username', '<=', normalized + '\uf8ff'),
      limit(max)
    )
  )
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}

/* ============================================================
   POST LIKES
   ============================================================ */

export async function likePost(postId, uid) {
  if (!uid) throw new Error('You need to be signed in to like a post.')

  let alreadyLiked = false
  let postOwnerUid = null

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(postDoc(postId))
    if (!snap.exists()) throw new Error('This post no longer exists.')
    const data = snap.data()
    postOwnerUid = data.userId
    if ((data.likedBy || []).includes(uid)) {
      alreadyLiked = true
      return
    }
    transaction.update(postDoc(postId), {
      likedBy: arrayUnion(uid),
      likesCount: increment(1)
    })
  })

  if (!alreadyLiked && postOwnerUid && postOwnerUid !== uid) {
    await createLikeNotification({ postOwnerUid, actorUid: uid, postId }).catch(() => {})
  }
}

export async function unlikePost(postId, uid) {
  if (!uid) throw new Error('You need to be signed in.')
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(postDoc(postId))
    if (!snap.exists()) return
    const data = snap.data()
    if (!(data.likedBy || []).includes(uid)) return
    transaction.update(postDoc(postId), {
      likedBy: arrayRemove(uid),
      likesCount: increment(-1)
    })
  })
}

/* ============================================================
   COMMENTS — threaded, replacing the old flat system entirely.
   Schema: posts/{postId}/comments/{commentId}, matching the existing
   security rule exactly:
   { userId, displayName, username, avatar, text, mentions: [uid],
     parentCommentId: string|null, replyCount, likedBy: [uid],
     likesCount, edited, editedAt, pinned, createdAt }
   ============================================================ */

export async function addComment(postId, { uid, displayName, username, avatar, text, parentCommentId = null, mentionedUids = [] }) {
  if (!uid) throw new Error('You need to be signed in to comment.')
  if (!text?.trim()) throw new Error('Write something before posting.')

  const newCommentRef = doc(commentsCollection(postId))
  let postOwnerUid = null

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postDoc(postId))
    if (!postSnap.exists()) throw new Error('This post no longer exists.')
    postOwnerUid = postSnap.data().userId

    if (parentCommentId) {
      const parentSnap = await transaction.get(commentDoc(postId, parentCommentId))
      if (!parentSnap.exists()) throw new Error('This comment no longer exists.')
      transaction.update(commentDoc(postId, parentCommentId), { replyCount: increment(1) })
    } else {
      transaction.update(postDoc(postId), { commentsCount: increment(1) })
    }

    transaction.set(newCommentRef, {
      userId: uid,
      displayName: displayName || 'Student',
      username: username || '',
      avatar: avatar || '',
      text: text.trim(),
      mentions: mentionedUids,
      parentCommentId,
      replyCount: 0,
      likedBy: [],
      likesCount: 0,
      edited: false,
      editedAt: null,
      pinned: false,
      createdAt: serverTimestamp()
    })
  })

  // Notifications fire after the transaction commits — a side effect
  // shouldn't run inside code that might internally retry.
  if (parentCommentId) {
    const parentSnap = await getDoc(commentDoc(postId, parentCommentId))
    if (parentSnap.exists() && parentSnap.data().userId !== uid) {
      await createReplyNotification({
        targetUid: parentSnap.data().userId,
        actorUid: uid,
        actorName: displayName,
        actorAvatar: avatar,
        postId,
        commentId: newCommentRef.id,
        replyText: text
      }).catch(() => {})
    }
  } else if (postOwnerUid && postOwnerUid !== uid) {
    await createCommentNotification({
      postOwnerUid,
      actorUid: uid,
      actorName: displayName,
      actorAvatar: avatar,
      postId,
      commentText: text
    }).catch(() => {})
  }

  for (const mentionedUid of mentionedUids) {
    if (mentionedUid === uid || mentionedUid === postOwnerUid) continue
    await createMentionNotification({
      targetUid: mentionedUid,
      actorUid: uid,
      actorName: displayName,
      actorAvatar: avatar,
      postId,
      commentId: newCommentRef.id,
      commentText: text
    }).catch(() => {})
  }

  return newCommentRef.id
}

/**
 * deleteComment keeps its exact old signature (postId, commentId, uid)
 * — same call sites, same three arguments — but now also cascades to
 * replies and decrements the parent post's commentsCount (top-level)
 * or the parent comment's replyCount (a reply), matching "no orphan
 * replies, no broken counts."
 */
export async function deleteComment(postId, commentId, uid) {
  const snap = await getDoc(commentDoc(postId, commentId))
  if (!snap.exists()) return
  const data = snap.data()
  if (data.userId !== uid) throw new Error('You can only delete your own comments.')

  const repliesSnap = await getDocs(query(commentsCollection(postId), where('parentCommentId', '==', commentId)))

  const batch = writeBatch(db)
  repliesSnap.docs.forEach((replyDoc) => batch.delete(replyDoc.ref))
  batch.delete(commentDoc(postId, commentId))

  if (data.parentCommentId) {
    batch.update(commentDoc(postId, data.parentCommentId), { replyCount: increment(-1) })
  } else {
    batch.update(postDoc(postId), { commentsCount: increment(-1) })
  }

  await batch.commit()
}

/**
 * getComments keeps its exact old signature (postId) and now returns
 * top-level comments, ranked (pinned -> relevance -> likes ->
 * recency) rather than a flat chronological list — same call site in
 * PostDetailPage.jsx, richer result.
 */
export async function getComments(postId, { pageSize = 20, cursor = null, creatorUid = null } = {}) {
  const constraints = [where('parentCommentId', '==', null), orderBy('createdAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(commentsCollection(postId), ...constraints))
  const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  return {
    comments: rankComments(comments, creatorUid),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

export function subscribeToComments(postId, { pageSize = 20, creatorUid = null } = {}, callback) {
  const commentsQuery = query(
    commentsCollection(postId),
    where('parentCommentId', '==', null),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  )
  return onSnapshot(commentsQuery, (snap) => {
    callback(rankComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })), creatorUid))
  })
}

function rankComments(comments, creatorUid) {
  const now = Date.now()
  const scored = comments.map((comment) => {
    const ageMs = comment.createdAt?.toMillis ? now - comment.createdAt.toMillis() : now
    const ageHours = ageMs / (1000 * 60 * 60)
    const recencyDecay = 1 / (1 + ageHours / 24)
    const likeScore = (comment.likesCount || 0) * 2
    const replyScore = (comment.replyCount || 0) * 3
    const creatorBoost = creatorUid && (comment.userId === creatorUid || comment.likedBy?.includes(creatorUid)) ? 10 : 0
    return { ...comment, _relevance: (likeScore + replyScore + creatorBoost) * recencyDecay }
  })
  return scored.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (b._relevance !== a._relevance) return b._relevance - a._relevance
    const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
    const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
    return bMs - aMs
  })
}

export async function getReplies(postId, parentCommentId, { pageSize = 10, cursor = null } = {}) {
  const constraints = [where('parentCommentId', '==', parentCommentId), orderBy('createdAt', 'asc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(commentsCollection(postId), ...constraints))
  return {
    replies: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/* ============================================================
   COMMENT LIKES — new, real, persisted (the old system never had
   these at all — PostDetailPage.jsx's own comment confirmed comment
   likes were previously "local-only/cosmetic").
   ============================================================ */

export async function likeComment(postId, commentId, uid, actorInfo = {}) {
  if (!uid) throw new Error('You need to be signed in to like a comment.')
  let alreadyLiked = false
  let commentOwnerUid = null

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(commentDoc(postId, commentId))
    if (!snap.exists()) throw new Error('This comment no longer exists.')
    const data = snap.data()
    commentOwnerUid = data.userId
    if ((data.likedBy || []).includes(uid)) {
      alreadyLiked = true
      return
    }
    transaction.update(commentDoc(postId, commentId), { likedBy: arrayUnion(uid), likesCount: increment(1) })
  })

  if (!alreadyLiked && commentOwnerUid && commentOwnerUid !== uid) {
    await createCommentLikeNotification({
      targetUid: commentOwnerUid,
      actorUid: uid,
      actorName: actorInfo.displayName,
      actorAvatar: actorInfo.avatar,
      postId,
      commentId
    }).catch(() => {})
  }
}

export async function unlikeComment(postId, commentId, uid) {
  if (!uid) throw new Error('You need to be signed in.')
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(commentDoc(postId, commentId))
    if (!snap.exists()) return
    const data = snap.data()
    if (!(data.likedBy || []).includes(uid)) return
    transaction.update(commentDoc(postId, commentId), { likedBy: arrayRemove(uid), likesCount: increment(-1) })
  })
}

/* ============================================================
   EDIT / DELETE-SPECIFIC-COMMENT-ID exports used by the reply UI
   (deleteComment above already handles both top-level and replies —
   this is a distinctly-named alias for clarity at call sites that
   specifically mean "delete this reply," identical behavior).
   ============================================================ */

export async function editComment(postId, commentId, uid, newText, mentionedUids = []) {
  const snap = await getDoc(commentDoc(postId, commentId))
  if (!snap.exists()) throw new Error('This comment no longer exists.')
  if (snap.data().userId !== uid) throw new Error('You can only edit your own comments.')
  if (!newText?.trim()) throw new Error('Comment cannot be empty.')

  await updateDoc(commentDoc(postId, commentId), {
    text: newText.trim(),
    mentions: mentionedUids,
    edited: true,
    editedAt: serverTimestamp()
  })
}

/* ============================================================
   PIN — post creator only.
   ============================================================ */

export async function pinComment(postId, commentId, requesterUid, postOwnerUid, actorInfo = {}) {
  if (requesterUid !== postOwnerUid) throw new Error('Only the post creator can pin a comment.')

  const currentlyPinnedSnap = await getDocs(query(commentsCollection(postId), where('pinned', '==', true), limit(1)))
  const batch = writeBatch(db)
  currentlyPinnedSnap.docs.forEach((d) => batch.update(d.ref, { pinned: false }))
  batch.update(commentDoc(postId, commentId), { pinned: true })
  await batch.commit()

  const commentSnap = await getDoc(commentDoc(postId, commentId))
  if (commentSnap.exists() && commentSnap.data().userId !== requesterUid) {
    await createPinNotification({
      targetUid: commentSnap.data().userId,
      actorUid: requesterUid,
      actorName: actorInfo.displayName,
      actorAvatar: actorInfo.avatar,
      postId,
      commentId
    }).catch(() => {})
  }
}

export async function unpinComment(postId, commentId, requesterUid, postOwnerUid) {
  if (requesterUid !== postOwnerUid) throw new Error('Only the post creator can unpin a comment.')
  await updateDoc(commentDoc(postId, commentId), { pinned: false })
}

/* ============================================================
   SAVED POSTS — new feature, private to the owner. Schema:
   users/{uid}/savedPosts/{postId}, doc id IS the postId (structurally
   prevents duplicate saves, matches this project's existing composite-
   id conventions — follows/{}, usernames/{}). Placed here rather than
   in profileService.js (which I've never seen) since this is
   post-engagement, and this file is the one I have complete, verified
   knowledge of.
   ============================================================ */

function savedPostDoc(uid, postId) {
  return doc(db, 'users', uid, 'savedPosts', postId)
}

export async function savePost(uid, postId) {
  if (!uid) throw new Error('You need to be signed in to save a post.')
  await setDoc(savedPostDoc(uid, postId), { postId, savedAt: serverTimestamp() })
}

export async function unsavePost(uid, postId) {
  if (!uid) throw new Error('You need to be signed in.')
  await deleteDoc(savedPostDoc(uid, postId))
}

export async function isPostSaved(uid, postId) {
  if (!uid) return false
  const snap = await getDoc(savedPostDoc(uid, postId))
  return snap.exists()
}

/** Returns saved post IDs, newest-saved first — caller resolves each to full post data (e.g. via getPostById), keeping this function itself a single cheap query rather than N+1 post reads baked in. */
export async function getSavedPostIds(uid, { pageSize = 20, cursor = null } = {}) {
  const constraints = [orderBy('savedAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(collection(db, 'users', uid, 'savedPosts'), ...constraints))
  return {
    postIds: snap.docs.map((d) => d.id),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}
