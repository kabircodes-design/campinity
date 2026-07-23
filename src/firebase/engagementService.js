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
import { getUserProfile } from './profileService.js'

const POSTS_COLLECTION = 'posts'
const COMMENTS_SUBCOLLECTION = 'comments'
const USERS_COLLECTION = 'users'
const NOTIFICATIONS_SUBCOLLECTION = 'notifications'

async function setLikeState(postId, uid, shouldBeLiked) {
  const postRef = doc(db, POSTS_COLLECTION, postId)

  const actorProfile = shouldBeLiked ? await getUserProfile(uid).catch(() => null) : null

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(postRef)
    if (!snap.exists()) return

    const data = snap.data()
    const likedBy = Array.isArray(data.likedBy) ? data.likedBy : []
    const alreadyLiked = likedBy.includes(uid)

    if (alreadyLiked === shouldBeLiked) return

    const nextLikedBy = shouldBeLiked ? [...likedBy, uid] : likedBy.filter((id) => id !== uid)
    const nextCount = Math.max((data.likesCount || 0) + (shouldBeLiked ? 1 : -1), 0)

    transaction.update(postRef, { likedBy: nextLikedBy, likesCount: nextCount })

    if (shouldBeLiked && data.userId && data.userId !== uid) {
      const notificationRef = doc(collection(db, USERS_COLLECTION, data.userId, NOTIFICATIONS_SUBCOLLECTION))
      transaction.set(notificationRef, {
        actorUid: uid,
        actorUsername: actorProfile?.username || '',
        actorDisplayName: actorProfile?.displayName || '',
        actorAvatar: actorProfile?.avatar || '',
        type: 'like',
        targetId: postId,
        read: false,
        createdAt: serverTimestamp()
      })
    }
  })
}

export async function likePost(postId, uid) {
  await setLikeState(postId, uid, true)
}

export async function unlikePost(postId, uid) {
  await setLikeState(postId, uid, false)
}

export async function getPostLikes(postId) {
  const snap = await getDoc(doc(db, POSTS_COLLECTION, postId))
  if (!snap.exists()) return []
  const data = snap.data()
  return Array.isArray(data.likedBy) ? data.likedBy : []
}

export async function getComments(postId) {
  const commentsQuery = query(
    collection(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(commentsQuery)
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function addComment(postId, { uid, displayName, username, text }) {
  const postRef = doc(db, POSTS_COLLECTION, postId)
  const commentRef = doc(collection(db, POSTS_COLLECTION, postId, COMMENTS_SUBCOLLECTION))

  const postSnap = await getDoc(postRef)
  const postAuthorId = postSnap.exists() ? postSnap.data().userId : null

  const batch = writeBatch(db)
  batch.set(commentRef, {
    userId: uid,
    displayName: displayName || '',
    username: username || '',
    text,
    createdAt: serverTimestamp()
  })
  batch.update(postRef, { commentsCount: increment(1) })

  if (postAuthorId && postAuthorId !== uid) {
    const notificationRef = doc(collection(db, USERS_COLLECTION, postAuthorId, NOTIFICATIONS_SUBCOLLECTION))
    batch.set(notificationRef, {
      actorUid: uid,
      actorUsername: username || '',
      actorDisplayName: displayName || '',
      actorAvatar: '',
      type: 'comment',
      targetId: postId,
      read: false,
      createdAt: serverTimestamp()
    })
  }

  await batch.commit()

  return commentRef.id
}

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