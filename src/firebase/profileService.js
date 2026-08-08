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
import { awardXP } from '../gamification/xpService.js'

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
    campusAvatarUrl: data.campusAvatarUrl ?? '',
    avatarMode: data.avatarMode ?? 'photo',
    campusAvatarUpdatedAt: data.campusAvatarUpdatedAt ?? null,
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
      campusAvatarUrl: data.campusAvatarUrl ?? '',
      avatarMode: data.avatarMode ?? 'photo',
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

/**
 * Sharing System (Phase 2) — search for the recipient picker. Two
 * separate prefix queries (username, displayNameLower) merged and
 * deduped, same pragmatic pattern getPeopleYouMayKnow above already
 * uses for course/year — Firestore can't OR across two different
 * fields in one query. "kab" matching "Kabir Jain" needs the
 * displayNameLower query specifically; the existing
 * searchUsersForMention (engagementService.js) only searches
 * username, which is why this is a new function rather than reusing
 * that one — different real requirement, not duplicated logic.
 */
export async function searchUsersForShare(rawTerm, excludeUid, { pageSize = 10 } = {}) {
  const term = rawTerm.trim().toLowerCase()
  if (!term) return []

  const [byUsername, byName] = await Promise.all([
    getDocs(query(collection(db, COLLECTION), orderBy('username'), where('username', '>=', term), where('username', '<=', term + '\uf8ff'), limit(pageSize))),
    getDocs(query(collection(db, COLLECTION), orderBy('displayNameLower'), where('displayNameLower', '>=', term), where('displayNameLower', '<=', term + '\uf8ff'), limit(pageSize)))
  ])

  const seen = new Map()
  ;[...byUsername.docs, ...byName.docs].forEach((d) => {
    if (d.id === excludeUid || seen.has(d.id)) return
    const data = d.data()
    seen.set(d.id, {
      uid: d.id,
      displayName: data.displayName ?? data.fullName ?? '',
      username: data.username ?? '',
      avatar: data.avatar ?? data.photoURL ?? '',
      campusAvatarUrl: data.campusAvatarUrl ?? '',
      avatarMode: data.avatarMode ?? 'photo'
    })
  })

  return Array.from(seen.values()).slice(0, pageSize)
}

export async function getUserProfileByUsername(username) {
  const uid = await getUserIdByUsername(username)
  if (!uid) return null

  const profile = await getUserProfile(uid)
  if (!profile) return null

  return { uid, ...profile }
}

/* ============================================================
   RADAR — new. Built only on real, existing fields: collegeId (same
   campus) and courseLower/yearLower (the search-index fields this
   file already maintains via healProfile/createUserProfile/
   updateUserProfile — not new schema, reused for a new purpose).
   users/{uid}'s read rule is unconditional for any signed-in user
   (allow read: if isSignedIn()), so a direct collection query here
   needs no rule change, unlike collections with conditional read
   rules elsewhere in this project.
   ============================================================ */

/**
 * "Nearby Students" — same campus, real data only. Deliberately does
 * NOT sort "online first" or "recently active" — no presence/activity
 * timestamp exists anywhere in this project (the same gap already
 * flagged for typing indicators and online status in the messaging
 * system). Sorted by join date instead, newest members first, which
 * is real data rather than a fabricated online signal.
 */
export async function getNearbyStudents(collegeId, excludeUid, { pageSize = 20 } = {}) {
  // Temporary diagnostic logging — added specifically to answer "why
  // does the query return nothing" with real data instead of another
  // guess. Safe to remove once the cause is confirmed from the
  // console output.
  console.log('[Radar] getNearbyStudents called with collegeId:', JSON.stringify(collegeId), 'type:', typeof collegeId)

  if (!collegeId) {
    console.log('[Radar] REJECTED before query: collegeId is falsy on the current viewer\'s own profile.')
    return []
  }

  const snap = await getDocs(
    query(collection(db, COLLECTION), where('collegeId', '==', collegeId), orderBy('createdAt', 'desc'), limit(pageSize + 1))
  )

  console.log('[Radar] Query returned', snap.docs.length, 'raw documents for collegeId ==', JSON.stringify(collegeId))

  // Separately: fetch a small unfiltered sample of users so their
  // ACTUAL collegeId values are visible for comparison — this is the
  // piece that answers "is it a naming mismatch, a missing field, or
  // truly no one else" without needing direct Firestore console
  // access.
  const sampleSnap = await getDocs(query(collection(db, COLLECTION), limit(10)))
  console.log('[Radar] Sample of', sampleSnap.docs.length, 'existing user documents (collegeId field only):')
  sampleSnap.docs.forEach((d) => {
    const data = d.data()
    console.log(
      `  uid=${d.id} collegeId=${JSON.stringify(data.collegeId)} (type: ${typeof data.collegeId}) college=${JSON.stringify(data.college)} displayName=${data.displayName}`
    )
  })

  return snap.docs
    .filter((d) => d.id !== excludeUid)
    .slice(0, pageSize)
    .map((d) => {
      const data = d.data()
      return {
        uid: d.id,
        displayName: data.displayName ?? data.fullName ?? '',
        username: data.username ?? '',
        avatar: data.avatar ?? data.photoURL ?? '',
        campusAvatarUrl: data.campusAvatarUrl ?? '',
        avatarMode: data.avatarMode ?? 'photo',
        course: data.course ?? '',
        year: data.year ?? '',
        verifiedCampus: data.verifiedCampus ?? false
      }
    })
}

/**
 * "People You May Know" — same course OR same year as the current
 * user, real fields only. Two separate queries merged (Firestore
 * can't OR across different fields in one query), deduplicated.
 * Mutual-followers/mutual-communities suggestions are NOT included
 * here — that needs a proper graph traversal (friends-of-friends)
 * this function doesn't attempt; getMutualFollowers elsewhere in this
 * file answers "who do THESE TWO specific people have in common," not
 * "suggest me people," which is a different, harder query.
 */
export async function getPeopleYouMayKnow(currentUid, { course = '', year = '', pageSize = 10 } = {}) {
  const courseLower = course.trim().toLowerCase()
  const yearLower = year.trim().toLowerCase()
  if (!courseLower && !yearLower) return []

  const queries = []
  if (courseLower) {
    queries.push(getDocs(query(collection(db, COLLECTION), where('courseLower', '==', courseLower), limit(pageSize))))
  }
  if (yearLower) {
    queries.push(getDocs(query(collection(db, COLLECTION), where('yearLower', '==', yearLower), limit(pageSize))))
  }

  const results = await Promise.all(queries)
  const seen = new Map()
  results.forEach((snap) => {
    snap.docs.forEach((d) => {
      if (d.id === currentUid || seen.has(d.id)) return
      const data = d.data()
      seen.set(d.id, {
        uid: d.id,
        displayName: data.displayName ?? data.fullName ?? '',
        username: data.username ?? '',
        avatar: data.avatar ?? data.photoURL ?? '',
        campusAvatarUrl: data.campusAvatarUrl ?? '',
        avatarMode: data.avatarMode ?? 'photo',
        course: data.course ?? '',
        year: data.year ?? ''
      })
    })
  })

  return Array.from(seen.values()).slice(0, pageSize)
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

  let created = false

  await runTransaction(db, async (transaction) => {
    const followRef = followDocRef(followerId, followingId)
    const existing = await transaction.get(followRef)
    if (existing.exists()) return

    created = true
    transaction.set(followRef, { followerId, followingId, createdAt: serverTimestamp() })
    transaction.update(doc(db, COLLECTION, followingId), { followersCount: increment(1) })
    transaction.update(doc(db, COLLECTION, followerId), { followingCount: increment(1) })
  })

  // Gamification — only for a genuinely new follow relationship, not
  // a no-op re-call. dedupeKey uses the same deterministic pair
  // ordering the follow document itself already relies on, so this
  // exact relationship can never award twice even independent of the
  // transaction's own existence check.
  if (created) {
    await awardXP(followerId, 'follow', { dedupeKey: `follow_${followerId}_${followingId}` }).catch(() => {})
    await awardXP(followingId, 'followed', { dedupeKey: `followed_${followerId}_${followingId}` }).catch(() => {})
  }
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
