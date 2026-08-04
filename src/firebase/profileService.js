import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where
} from 'firebase/firestore'
import { db, auth } from './firebase.js'
import { getUserIdByUsername, ensureUsernameReservation } from './usernameService.js'

const COLLECTION = 'users'

async function healProfile(uid, data) {
  if (data?.searchIndexed) return
  if (auth.currentUser?.uid !== uid) return

  const updates = {}

  if (data?.username && !data.usernameReserved) {
    const result = await ensureUsernameReservation(uid, data.username).catch(() => null)
    if (result?.ok) updates.usernameReserved = true
  }

  const displayName = data?.displayName ?? data?.fullName ?? ''
  updates.displayNameLower = displayName.trim().toLowerCase()
  updates.courseLower = (data?.course || '').trim().toLowerCase()
  updates.yearLower = (data?.year || '').trim().toLowerCase()
  updates.searchIndexed = true

  await setDoc(doc(db, COLLECTION, uid), updates, { merge: true }).catch(() => null)
}

/**
 * website and pinnedPostIds added below — new fields for the profile
 * redesign, both write-compatible with zero changes needed (setDoc
 * with merge:true, which updateUserProfile already uses, writes any
 * field passed to it regardless of whether it previously existed —
 * Firestore documents don't require a fixed schema). The real bug
 * this would have caused: getUserProfile explicitly lists which
 * fields to return, so without adding them here, both fields would
 * write successfully and then read back as undefined forever — a
 * silent data-loss-on-read bug, not a write failure.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, COLLECTION, uid))
  if (!snap.exists()) return null

  const data = snap.data()

  healProfile(uid, data)

  return {
    displayName: data.displayName ?? data.fullName ?? '',
    username: data.username ?? '',
    bio: data.bio ?? '',
    collegeId: data.collegeId ?? null,
    course: data.course ?? '',
    year: data.year ?? '',
    division: data.division ?? '',
    avatar: data.avatar ?? data.photoURL ?? '',
    coverPhoto: data.coverPhoto ?? '',
    website: data.website ?? '',
    verifiedCampus: data.verifiedCampus ?? false,
    followersCount: data.followersCount ?? 0,
    followingCount: data.followingCount ?? 0,
    skills: Array.isArray(data.skills) ? data.skills : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
    pinnedPostIds: Array.isArray(data.pinnedPostIds) ? data.pinnedPostIds : [],
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null
  }
}

export async function createUserProfile(uid, data = {}) {
  const ref = doc(db, COLLECTION, uid)
  await setDoc(
    ref,
    {
      displayName: data.displayName ?? '',
      displayNameLower: (data.displayName ?? '').trim().toLowerCase(),
      username: data.username ?? '',
      bio: data.bio ?? '',
      collegeId: data.collegeId ?? null,
      course: data.course ?? '',
      courseLower: (data.course ?? '').trim().toLowerCase(),
      year: data.year ?? '',
      yearLower: (data.year ?? '').trim().toLowerCase(),
      division: data.division ?? '',
      avatar: data.avatar ?? '',
      coverPhoto: data.coverPhoto ?? '',
      website: data.website ?? '',
      verifiedCampus: data.verifiedCampus ?? false,
      skills: Array.isArray(data.skills) ? data.skills : [],
      interests: Array.isArray(data.interests) ? data.interests : [],
      pinnedPostIds: [],
      searchIndexed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
}

export async function updateUserProfile(uid, data) {
  const ref = doc(db, COLLECTION, uid)
  const payload = { ...data, updatedAt: serverTimestamp() }

  if (typeof data.displayName === 'string') {
    payload.displayNameLower = data.displayName.trim().toLowerCase()
  }
  if (typeof data.course === 'string') {
    payload.courseLower = data.course.trim().toLowerCase()
  }
  if (typeof data.year === 'string') {
    payload.yearLower = data.year.trim().toLowerCase()
  }

  await setDoc(ref, payload, { merge: true })
}

/**
 * Pin/unpin — up to 3 posts, per the brief. Enforced here (client-side
 * check) since pinnedPostIds is just a field on users/{uid}, already
 * covered by the existing isOwner(uid) update rule — no new Firestore
 * rule needed, this is the only enforcement layer, same as
 * communityService.js's own client-side permission checks elsewhere
 * in this project.
 */
export async function togglePinnedPost(uid, postId) {
  const profile = await getUserProfile(uid)
  if (!profile) throw new Error('Profile not found.')

  const isPinned = profile.pinnedPostIds.includes(postId)
  let nextPinned

  if (isPinned) {
    nextPinned = profile.pinnedPostIds.filter((id) => id !== postId)
  } else {
    if (profile.pinnedPostIds.length >= 3) {
      throw new Error('You can only pin up to 3 posts. Unpin one first.')
    }
    nextPinned = [...profile.pinnedPostIds, postId]
  }

  await setDoc(doc(db, COLLECTION, uid), { pinnedPostIds: nextPinned, updatedAt: serverTimestamp() }, { merge: true })
  return nextPinned
}

export async function getUserProfileByUsername(username) {
  const uid = await getUserIdByUsername(username)
  if (!uid) return null

  const profile = await getUserProfile(uid)
  if (!profile) return null

  return { uid, ...profile }
}

/* ============================================================
   FOLLOW GRAPH — new. Schema matches the existing follows/{} security
   rule exactly: composite doc id "{followerId}_{followingId}"
   (structurally prevents duplicate follow records, same pattern as
   usernames/{} and chats/{} elsewhere in this project),
   followerId/followingId fields. followersCount/followingCount on
   users/{uid} are updated transactionally alongside the follow
   record's own create/delete — matches the existing security rule,
   which specifically allows followersCount/followingCount to be
   updated in isolation by any signed-in user (exactly so a follow/
   unfollow action by someone ELSE can adjust the target's counter).
   ============================================================ */

function followDocRef(followerId, followingId) {
  return doc(db, 'follows', `${followerId}_${followingId}`)
}

export async function followUser(followerId, followingId) {
  if (!followerId) throw new Error('You need to be signed in to follow someone.')
  if (followerId === followingId) throw new Error("You can't follow yourself.")

  await runTransaction(db, async (transaction) => {
    const followRef = followDocRef(followerId, followingId)
    const existing = await transaction.get(followRef)
    if (existing.exists()) return

    transaction.set(followRef, { followerId, followingId, createdAt: serverTimestamp() })
    transaction.update(doc(db, COLLECTION, followingId), { followersCount: increment(1) })
    transaction.update(doc(db, COLLECTION, followerId), { followingCount: increment(1) })
  })
}

export async function unfollowUser(followerId, followingId) {
  if (!followerId) throw new Error('You need to be signed in.')

  await runTransaction(db, async (transaction) => {
    const followRef = followDocRef(followerId, followingId)
    const existing = await transaction.get(followRef)
    if (!existing.exists()) return

    transaction.delete(followRef)
    transaction.update(doc(db, COLLECTION, followingId), { followersCount: increment(-1) })
    transaction.update(doc(db, COLLECTION, followerId), { followingCount: increment(-1) })
  })
}

export async function checkIsFollowing(followerId, followingId) {
  if (!followerId || !followingId) return false
  const snap = await getDoc(followDocRef(followerId, followingId))
  return snap.exists()
}

/**
 * Paginated, searchable follower/following list — the actual backend
 * for the redesigned bottom-sheet requirement (search, infinite
 * scroll). `direction` picks which side of the follows/{} record to
 * query: 'followers' = people who follow targetUid (where followingId
 * == targetUid), 'following' = people targetUid follows (where
 * followerId == targetUid). Search is client-filtered on the already-
 * fetched page by displayName/username — Firestore has no native
 * text search, same pragmatic tradeoff already used for community
 * search elsewhere in this project.
 */
export async function getFollowListPage(targetUid, direction, { pageSize = 20, cursor = null, searchTerm = '', viewerUid = null } = {}) {
  const field = direction === 'followers' ? 'followingId' : 'followerId'
  const constraints = [where(field, '==', targetUid), orderBy('createdAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))

  const snap = await getDocs(query(collection(db, 'follows'), ...constraints))
  const otherUidField = direction === 'followers' ? 'followerId' : 'followingId'
  const otherUids = snap.docs.map((d) => d.data()[otherUidField])

  // Batched, not N+1: the viewer's own following-set is fetched ONCE
  // per page (not once per card in FollowUserCard.jsx), then checked
  // via a Set membership test for each user in this page's results.
  let viewerFollowingSet = new Set()
  if (viewerUid) {
    const viewerFollowsSnap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', viewerUid)))
    viewerFollowingSet = new Set(viewerFollowsSnap.docs.map((d) => d.data().followingId))
  }

  const profiles = await Promise.all(
    otherUids.map(async (uid) => {
      const profile = await getUserProfile(uid).catch(() => null)
      return profile ? { uid, ...profile, viewerIsFollowing: viewerFollowingSet.has(uid) } : null
    })
  )

  let users = profiles.filter(Boolean)
  const normalizedSearch = searchTerm.trim().toLowerCase()
  if (normalizedSearch) {
    users = users.filter(
      (u) => u.displayName.toLowerCase().includes(normalizedSearch) || u.username.toLowerCase().includes(normalizedSearch)
    )
  }

  return {
    users,
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/**
 * Mutual followers — people who follow BOTH the current signed-in
 * user AND the profile being viewed. Fetches the viewed profile's
 * follower uid SET (capped at a reasonable page for this purpose,
 * not the full paginated list) and cross-references against the
 * current user's OWN followers via getFollowListPage. Two queries
 * plus profile lookups for the intersection only — not a full scan
 * of either side's entire follower list.
 */
export async function getMutualFollowers(viewerUid, profileUid, { limit: max = 3 } = {}) {
  if (!viewerUid || viewerUid === profileUid) return []

  const [viewerFollowersSnap, profileFollowersSnap] = await Promise.all([
    getDocs(query(collection(db, 'follows'), where('followingId', '==', viewerUid))),
    getDocs(query(collection(db, 'follows'), where('followingId', '==', profileUid)))
  ])

  const viewerFollowerUids = new Set(viewerFollowersSnap.docs.map((d) => d.data().followerId))
  const mutualUids = profileFollowersSnap.docs
    .map((d) => d.data().followerId)
    .filter((uid) => viewerFollowerUids.has(uid))
    .slice(0, max)

  const profiles = await Promise.all(
    mutualUids.map(async (uid) => {
      const profile = await getUserProfile(uid).catch(() => null)
      return profile ? { uid, ...profile } : null
    })
  )

  return profiles.filter(Boolean)
}


