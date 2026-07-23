import { collection, doc, getDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'
import { getUserProfile } from './profileService.js'

const FOLLOWS_COLLECTION = 'follows'
const USERS_COLLECTION = 'users'
const NOTIFICATIONS_SUBCOLLECTION = 'notifications'

function followDocId(followerId, followingId) {
  return `${followerId}_${followingId}`
}

export async function isFollowing(followerId, followingId) {
  if (!followerId || !followingId) return false
  const snap = await getDoc(doc(db, FOLLOWS_COLLECTION, followDocId(followerId, followingId)))
  return snap.exists()
}

export async function followUser(followerId, followingId) {
  if (!followerId || !followingId) return
  if (followerId === followingId) {
    const err = new Error("You can't follow yourself")
    err.code = 'self-follow'
    throw err
  }

  const followRef = doc(db, FOLLOWS_COLLECTION, followDocId(followerId, followingId))
  const followerRef = doc(db, USERS_COLLECTION, followerId)
  const followingRef = doc(db, USERS_COLLECTION, followingId)
  const notificationRef = doc(collection(db, USERS_COLLECTION, followingId, NOTIFICATIONS_SUBCOLLECTION))

  const actorProfile = await getUserProfile(followerId).catch(() => null)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(followRef)
    if (existing.exists()) return

    transaction.set(followRef, {
      followerId,
      followingId,
      createdAt: serverTimestamp()
    })

    transaction.set(followerRef, { followingCount: increment(1) }, { merge: true })
    transaction.set(followingRef, { followersCount: increment(1) }, { merge: true })

    transaction.set(notificationRef, {
      actorUid: followerId,
      actorUsername: actorProfile?.username || '',
      actorDisplayName: actorProfile?.displayName || '',
      actorAvatar: actorProfile?.avatar || '',
      type: 'follow',
      targetId: followerId,
      read: false,
      createdAt: serverTimestamp()
    })
  })
}

export async function unfollowUser(followerId, followingId) {
  if (!followerId || !followingId) return

  const followRef = doc(db, FOLLOWS_COLLECTION, followDocId(followerId, followingId))
  const followerRef = doc(db, USERS_COLLECTION, followerId)
  const followingRef = doc(db, USERS_COLLECTION, followingId)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(followRef)
    if (!existing.exists()) return

    const followerSnap = await transaction.get(followerRef)
    const followingSnap = await transaction.get(followingRef)

    const nextFollowingCount = Math.max((followerSnap.data()?.followingCount || 0) - 1, 0)
    const nextFollowersCount = Math.max((followingSnap.data()?.followersCount || 0) - 1, 0)

    transaction.delete(followRef)
    transaction.set(followerRef, { followingCount: nextFollowingCount }, { merge: true })
    transaction.set(followingRef, { followersCount: nextFollowersCount }, { merge: true })
  })
}