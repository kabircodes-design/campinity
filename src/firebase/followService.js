import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore'
import { db } from './firebase.js'
import { getUserProfile } from './profileService.js'

const FOLLOWS_COLLECTION = 'follows'
const USERS_COLLECTION = 'users'
const NOTIFICATIONS_SUBCOLLECTION = 'notifications'

function followDocId(followerId, followingId) {
  return `${followerId}_${followingId}`
}

/**
 * Checks whether `followerId` currently follows `followingId`. A single
 * O(1) document read via the composite id (followerId_followingId) —
 * no query needed, and the composite id structurally prevents duplicate
 * follow records (a second follow attempt targets the same doc).
 */
export async function isFollowing(followerId, followingId) {
  if (!followerId || !followingId) return false
  const snap = await getDoc(doc(db, FOLLOWS_COLLECTION, followDocId(followerId, followingId)))
  return snap.exists()
}

/**
 * Follows `followingId` on behalf of `followerId`.
 *
 * - Rejects following yourself.
 * - Idempotent: if the follow record already exists, this is a safe
 *   no-op — no duplicate record, no double-counted followers.
 * - Atomically creates the follow record, increments both users'
 *   counters, and creates a 'follow' notification for the followed
 *   user — all in one transaction, so none of it can partially apply.
 *
 * Throws with `.code === 'self-follow'` if followerId === followingId.
 */
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

  // Read outside the transaction — it's the actor's own profile for the
  // notification, not part of the follow/counter invariant the
  // transaction needs to protect.
  const actorProfile = await getUserProfile(followerId).catch(() => null)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(followRef)
    if (existing.exists()) return // already following — no-op

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

/**
 * Unfollows `followingId` on behalf of `followerId`.
 *
 * - Idempotent: if there's no existing follow record, this is a safe
 *   no-op.
 * - Counters are read-then-clamped to zero rather than blindly
 *   decremented, so a counter can never go negative even if it was
 *   already inconsistent for some other reason.
 */
export async function unfollowUser(followerId, followingId) {
  if (!followerId || !followingId) return

  const followRef = doc(db, FOLLOWS_COLLECTION, followDocId(followerId, followingId))
  const followerRef = doc(db, USERS_COLLECTION, followerId)
  const followingRef = doc(db, USERS_COLLECTION, followingId)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(followRef)
    if (!existing.exists()) return // not following — no-op

    const followerSnap = await transaction.get(followerRef)
    const followingSnap = await transaction.get(followingRef)

    const nextFollowingCount = Math.max((followerSnap.data()?.followingCount || 0) - 1, 0)
    const nextFollowersCount = Math.max((followingSnap.data()?.followersCount || 0) - 1, 0)

    transaction.delete(followRef)
    transaction.set(followerRef, { followingCount: nextFollowingCount }, { merge: true })
    transaction.set(followingRef, { followersCount: nextFollowersCount }, { merge: true })
  })
}

/**
 * Realtime listener for the uids of everyone who follows `uid`. A plain
 * equality filter — no orderBy, no composite index needed. Returns the
 * unsubscribe function. Callback receives an array of follower uids;
 * ordering isn't queried for (createdAt isn't part of this filter), so
 * FollowersPage/useFollowList treat this as an unordered id list and
 * simply render whatever order profiles resolve in — keeps this query
 * as cheap and index-free as possible.
 */
export function subscribeToFollowerIds(uid, callback, onError) {
  const followersQuery = query(collection(db, FOLLOWS_COLLECTION), where('followingId', '==', uid))
  return onSnapshot(
    followersQuery,
    (snap) => callback(snap.docs.map((docSnap) => docSnap.data().followerId).filter(Boolean)),
    (err) => onError?.(err)
  )
}

/**
 * Realtime listener for the uids of everyone `uid` follows. Same
 * index-free pattern as subscribeToFollowerIds.
 */
export function subscribeToFollowingIds(uid, callback, onError) {
  const followingQuery = query(collection(db, FOLLOWS_COLLECTION), where('followerId', '==', uid))
  return onSnapshot(
    followingQuery,
    (snap) => callback(snap.docs.map((docSnap) => docSnap.data().followingId).filter(Boolean)),
    (err) => onError?.(err)
  )
}