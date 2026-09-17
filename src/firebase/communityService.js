/**
 * Communities service — one collection design supporting every type
 * listed in the brief (official_club, study_group, hostel, batch,
 * branch, society, event, custom) via a single `type` field rather
 * than separate collections per type, so adding a new type later is a
 * data change, not a schema migration.
 *
 * Firestore layout (corrected — the previous version of this comment
 * described members as a subcollection of communities/{id}; the actual
 * code below has always used a top-level composite-id collection
 * instead, same pattern as follows/{} and usernames/{} elsewhere in
 * this app. The comment was out of sync with the code; fixed here
 * rather than left contradictory):
 *   communities/{communityId}
 *   communityMembers/{communityId}_{uid}
 *   communityRequests/{communityId}_{uid}
 *   communityHandles/{handle}
 *
 * Community posts now live in the shared posts/ collection (with a
 * communityId field), NOT a separate communityPosts collection — a
 * later, more specific instruction superseded the original "keep
 * completely separate" brief. createCommunityPost/getCommunityPosts
 * (the old communityPosts-collection versions) have been removed;
 * see getCommunityFeedPosts below for the replacement.
 */
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
import { deleteObject, getStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db } from './firebase.js'
import { awardXP } from '../gamification/xpService.js'
import { mapPostDoc } from './postService.js'

export const COMMUNITY_TYPES = [
  'official_club',
  'study_group',
  'hostel',
  'batch',
  'branch',
  'society',
  'event',
  'custom'
]

export const MEMBER_ROLES = ['member', 'moderator', 'admin', 'owner']

function communityDocRef(communityId) {
  return doc(db, 'communities', communityId)
}

/**
 * communityMembers/{communityId}_{uid} — top-level collection per the
 * final schema decision, NOT a subcollection of communities/{id}. The
 * doc id is still the deterministic composite "{communityId}_{uid}" —
 * same structural-uniqueness pattern this codebase already uses for
 * follows/{followerId_followingId} and usernames/{username} — which is
 * what makes joinCommunity/leaveCommunity's transactions able to
 * atomically check "does this membership already exist" via a direct
 * doc reference instead of a query (Firestore transactions can only
 * .get() a specific doc, not run a query). uid and communityId are
 * still stored as real fields on the doc (not just implied by the doc
 * id), exactly as specified.
 */
function memberDocRef(communityId, uid) {
  return doc(db, 'communityMembers', `${communityId}_${uid}`)
}

function requestDocRef(communityId, uid) {
  return doc(db, 'communityRequests', `${communityId}_${uid}`)
}

function banDocRef(communityId, uid) {
  return doc(db, 'communityBans', `${communityId}_${uid}`)
}

/**
 * Channels — communities/{communityId}/channels/{channelId}, a real
 * subcollection (not a hardcoded/UI-only list): every community gets
 * these 4 written as genuine documents at creation time (createCommunity
 * below), and posts/{postId} carries a real channelId field pointing at
 * one of them (communityId → channelId → post, per the explicit
 * architecture requirement). Deliberately NOT a full Discord-style
 * user-createable-channel system — admins/owner can add MORE channels
 * (createCommunityChannel below) on top of this real starting set, but
 * there's no channel-permissions/ordering system beyond that, matching
 * "don't over-engineer this into a Discord clone."
 */
export const DEFAULT_CHANNELS = [
  { id: 'general', name: 'General', description: 'General discussion for the whole community.' },
  { id: 'announcements', name: 'Announcements', description: 'Official updates from owners and admins.' },
  { id: 'events', name: 'Events', description: 'Upcoming events and meetups.' },
  { id: 'study', name: 'Study', description: 'Notes, resources and study discussion.' }
]

function channelDocRef(communityId, channelId) {
  return doc(db, 'communities', communityId, 'channels', channelId)
}

function slugifyChannelName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

export async function getCommunityChannels(communityId) {
  const snap = await getDocs(query(collection(db, 'communities', communityId, 'channels'), orderBy('order', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Owner/admin only — adds a channel on top of the 4 real defaults every community already has. */
export async function createCommunityChannel(communityId, requesterUid, { name, description = '' }) {
  const trimmedName = name?.trim()
  if (!trimmedName) throw new Error('Channel name is required.')
  const communitySnap = await getDoc(communityDocRef(communityId))
  if (!communitySnap.exists()) throw new Error('Community not found.')
  const community = communitySnap.data()
  if (community.ownerId !== requesterUid && !(community.admins || []).includes(requesterUid)) {
    throw new Error('Only the owner or an admin can create channels.')
  }

  const channelId = slugifyChannelName(trimmedName) || `channel-${Date.now()}`
  const existing = await getDoc(channelDocRef(communityId, channelId))
  if (existing.exists()) throw new Error('A channel with that name already exists.')

  await setDoc(channelDocRef(communityId, channelId), {
    communityId,
    name: trimmedName,
    description: description?.trim() || '',
    createdBy: requesterUid,
    createdAt: serverTimestamp(),
    order: Date.now()
  })
  return channelId
}

/** Maps a Firestore community doc + snapshot id into the plain shape UI reads. */
function mapCommunityDoc(docSnap) {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    name: data.name || '',
    handle: data.handle || '',
    description: data.description || '',
    type: data.type || 'custom',
    privacy: data.privacy || 'public',
    collegeId: data.collegeId || null,
    ownerId: data.ownerId,
    admins: data.admins || [],
    moderators: data.moderators || [],
    membersCount: data.membersCount || 0,
    coverImage: data.coverImage || '',
    icon: data.icon || '',
    tags: data.tags || [],
    rules: data.rules || '',
    createdAt: data.createdAt
  }
}

/**
 * Creates a community. Handle uniqueness is enforced the same way
 * usernameService.js enforces username uniqueness (inferred from the
 * usernames/{username} security rule): a transaction that reads a
 * reservation doc at communityHandles/{handle} and fails atomically if
 * it already exists, rather than a query-then-write race.
 */
export async function createCommunity({
  uid,
  name,
  handle,
  description,
  type,
  privacy = 'public',
  collegeId = null,
  coverImage = '',
  icon = '',
  tags = [],
  rules = ''
}) {
  if (!uid) throw new Error('You need to be signed in to create a community.')
  if (!name?.trim()) throw new Error('Community name is required.')
  if (!handle?.trim()) throw new Error('Community handle is required.')
  if (!COMMUNITY_TYPES.includes(type)) throw new Error('Invalid community type.')

  const normalizedHandle = handle.trim().toLowerCase()
  const handleRef = doc(db, 'communityHandles', normalizedHandle)
  const newCommunityRef = doc(collection(db, 'communities'))

  await runTransaction(db, async (transaction) => {
    const handleSnap = await transaction.get(handleRef)
    if (handleSnap.exists()) {
      throw new Error('That handle is already taken.')
    }

    transaction.set(handleRef, { communityId: newCommunityRef.id, uid })

    transaction.set(newCommunityRef, {
      name: name.trim(),
      handle: normalizedHandle,
      description: description?.trim() || '',
      type,
      privacy,
      collegeId,
      ownerId: uid,
      admins: [],
      moderators: [],
      membersCount: 1,
      coverImage,
      icon,
      tags,
      rules: rules?.trim() || '',
      createdAt: serverTimestamp()
    })

    transaction.set(memberDocRef(newCommunityRef.id, uid), {
      uid,
      communityId: newCommunityRef.id,
      role: 'owner',
      joinedAt: serverTimestamp()
    })

    // Real per-community channel docs, written here (not fabricated in
    // the UI) — every community starts with the same 4 real channels;
    // General is where an un-targeted post lands by default.
    DEFAULT_CHANNELS.forEach((channel, index) => {
      transaction.set(channelDocRef(newCommunityRef.id, channel.id), {
        communityId: newCommunityRef.id,
        name: channel.name,
        description: channel.description,
        createdBy: uid,
        createdAt: serverTimestamp(),
        order: index
      })
    })
  })

  return newCommunityRef.id
}

export async function getCommunityById(communityId) {
  const snap = await getDoc(communityDocRef(communityId))
  if (!snap.exists()) return null
  return mapCommunityDoc(snap)
}

export async function getMembership(communityId, uid) {
  if (!uid) return null
  const snap = await getDoc(memberDocRef(communityId, uid))
  if (!snap.exists()) return null
  return snap.data()
}

export async function getMembers(communityId, { pageSize = 30, cursor = null } = {}) {
  const constraints = [where('communityId', '==', communityId), orderBy('joinedAt', 'asc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(collection(db, 'communityMembers'), ...constraints))
  return {
    members: snap.docs.map((d) => d.data()),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/** Public community: joins immediately. Private: caller should use requestToJoin instead. */
export async function joinCommunity(communityId, uid) {
  if (!uid) throw new Error('You need to be signed in to join.')

  let joined = false

  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    if (communitySnap.data().privacy === 'private') {
      throw new Error('This community is private — use requestToJoin instead.')
    }

    const memberSnap = await transaction.get(memberDocRef(communityId, uid))
    if (memberSnap.exists()) return

    joined = true
    transaction.set(memberDocRef(communityId, uid), {
      uid,
      communityId,
      role: 'member',
      joinedAt: serverTimestamp()
    })
    transaction.update(communityDocRef(communityId), { membersCount: increment(1) })
  })

  if (joined) {
    await awardXP(uid, 'club_joined', { dedupeKey: `club_joined_${communityId}_${uid}` }).catch(() => {})
  }
}

export async function leaveCommunity(communityId, uid) {
  if (!uid) throw new Error('You need to be signed in.')

  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    if (communitySnap.data().ownerId === uid) {
      throw new Error('The owner must transfer ownership before leaving.')
    }

    const memberSnap = await transaction.get(memberDocRef(communityId, uid))
    if (!memberSnap.exists()) return

    transaction.delete(memberDocRef(communityId, uid))
    transaction.update(communityDocRef(communityId), { membersCount: increment(-1) })

    const admins = communitySnap.data().admins || []
    const moderators = communitySnap.data().moderators || []
    if (admins.includes(uid)) {
      transaction.update(communityDocRef(communityId), { admins: admins.filter((id) => id !== uid) })
    }
    if (moderators.includes(uid)) {
      transaction.update(communityDocRef(communityId), { moderators: moderators.filter((id) => id !== uid) })
    }
  })
}

export async function requestToJoin(communityId, uid) {
  if (!uid) throw new Error('You need to be signed in to request to join.')
  await setDoc(requestDocRef(communityId, uid), {
    communityId,
    uid,
    status: 'pending',
    requestedAt: serverTimestamp()
  })
}

export async function getPendingRequests(communityId) {
  const snap = await getDocs(
    query(collection(db, 'communityRequests'), where('communityId', '==', communityId), where('status', '==', 'pending'))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function acceptRequest(communityId, uid) {
  await runTransaction(db, async (transaction) => {
    const reqRef = requestDocRef(communityId, uid)
    const reqSnap = await transaction.get(reqRef)
    if (!reqSnap.exists() || reqSnap.data().status !== 'pending') {
      throw new Error('This request is no longer pending.')
    }

    transaction.set(memberDocRef(communityId, uid), {
      uid,
      communityId,
      role: 'member',
      joinedAt: serverTimestamp()
    })
    transaction.update(communityDocRef(communityId), { membersCount: increment(1) })
    transaction.delete(reqRef)
  })
}

export async function rejectRequest(communityId, uid) {
  await deleteDoc(requestDocRef(communityId, uid))
}

/** Owner/admin actions — role changes on the community's admins[] array. */
export async function promoteToAdmin(communityId, requesterUid, targetUid) {
  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    const community = communitySnap.data()
    if (community.ownerId !== requesterUid && !(community.admins || []).includes(requesterUid)) {
      throw new Error('Only the owner or an admin can promote members.')
    }

    const memberRef = memberDocRef(communityId, targetUid)
    const memberSnap = await transaction.get(memberRef)
    if (!memberSnap.exists()) throw new Error('That person is not a member of this community.')

    transaction.update(communityDocRef(communityId), { admins: arrayUnion(targetUid) })
    transaction.update(memberRef, { role: 'admin' })
  })
}

export async function removeAdmin(communityId, requesterUid, targetUid) {
  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    const community = communitySnap.data()
    if (community.ownerId !== requesterUid) {
      throw new Error('Only the owner can remove an admin.')
    }

    const memberRef = memberDocRef(communityId, targetUid)
    const memberSnap = await transaction.get(memberRef)
    if (!memberSnap.exists()) throw new Error('That person is not a member of this community.')

    transaction.update(communityDocRef(communityId), { admins: arrayRemove(targetUid) })
    transaction.update(memberRef, { role: 'member' })
  })
}

/** Same admins[]/moderators[]-array pattern as promoteToAdmin/removeAdmin, for the moderator role instead. */
export async function promoteToModerator(communityId, targetUid) {
  await runTransaction(db, async (transaction) => {
    const memberRef = memberDocRef(communityId, targetUid)
    const memberSnap = await transaction.get(memberRef)
    if (!memberSnap.exists()) throw new Error('That person is not a member of this community.')

    transaction.update(communityDocRef(communityId), { moderators: arrayUnion(targetUid) })
    transaction.update(memberRef, { role: 'moderator' })
  })
}

export async function demoteModerator(communityId, targetUid) {
  await runTransaction(db, async (transaction) => {
    const memberRef = memberDocRef(communityId, targetUid)
    const memberSnap = await transaction.get(memberRef)
    if (!memberSnap.exists()) throw new Error('That person is not a member of this community.')

    transaction.update(communityDocRef(communityId), { moderators: arrayRemove(targetUid) })
    transaction.update(memberRef, { role: 'member' })
  })
}

/**
 * Admin/owner removing SOMEONE ELSE — same mechanics as leaveCommunity
 * (delete membership, decrement count, clean up admins/moderators
 * arrays if applicable) but callable on another uid's behalf. The
 * owner can't be removed this way — same protection leaveCommunity
 * already has, just phrased for a caller acting on someone else.
 */
export async function removeMember(communityId, targetUid) {
  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    if (communitySnap.data().ownerId === targetUid) {
      throw new Error('The owner cannot be removed — transfer ownership first.')
    }

    const memberRef = memberDocRef(communityId, targetUid)
    const memberSnap = await transaction.get(memberRef)
    if (!memberSnap.exists()) return

    transaction.delete(memberRef)
    transaction.update(communityDocRef(communityId), { membersCount: increment(-1) })

    const admins = communitySnap.data().admins || []
    const moderators = communitySnap.data().moderators || []
    if (admins.includes(targetUid)) {
      transaction.update(communityDocRef(communityId), { admins: arrayRemove(targetUid) })
    }
    if (moderators.includes(targetUid)) {
      transaction.update(communityDocRef(communityId), { moderators: arrayRemove(targetUid) })
    }
  })
}

/**
 * Ban — deliberately distinct from removeMember above, not a synonym
 * for it. Removing just deletes the membership doc (they can rejoin a
 * public community immediately); banning does the same membership
 * cleanup AND writes a communityBans/{communityId}_{uid} record that
 * firestore.rules' own communityMembers/communityRequests create rules
 * now check (`!exists(.../communityBans/$(communityId_uid))`) before
 * allowing either a fresh join or a join request — the actual
 * enforcement lives there, not in this function's own checks, which
 * exist only to fail early with a clear message.
 */
export async function banMember(communityId, requesterUid, targetUid) {
  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    const community = communitySnap.data()
    if (community.ownerId !== requesterUid && !(community.admins || []).includes(requesterUid)) {
      throw new Error('Only the owner or an admin can ban members.')
    }
    if (community.ownerId === targetUid) {
      throw new Error('The owner cannot be banned.')
    }

    const memberRef = memberDocRef(communityId, targetUid)
    const memberSnap = await transaction.get(memberRef)
    if (memberSnap.exists()) {
      transaction.delete(memberRef)
      transaction.update(communityDocRef(communityId), { membersCount: increment(-1) })
      const admins = community.admins || []
      const moderators = community.moderators || []
      if (admins.includes(targetUid)) transaction.update(communityDocRef(communityId), { admins: arrayRemove(targetUid) })
      if (moderators.includes(targetUid)) transaction.update(communityDocRef(communityId), { moderators: arrayRemove(targetUid) })
    }

    transaction.set(banDocRef(communityId, targetUid), {
      communityId,
      uid: targetUid,
      bannedBy: requesterUid,
      bannedAt: serverTimestamp()
    })
  })
}

export async function unbanMember(communityId, targetUid) {
  await deleteDoc(banDocRef(communityId, targetUid))
}

export async function isMemberBanned(communityId, uid) {
  if (!uid) return false
  const snap = await getDoc(banDocRef(communityId, uid))
  return snap.exists()
}

/**
 * Mute Community — a per-member preference (I don't want notifications
 * from this community), not a moderation action. Writes ONLY the
 * `muted` field on the caller's OWN membership doc — the one field
 * firestore.rules' communityMembers update rule lets a plain member
 * touch on their own doc; everything else about that doc (role) stays
 * owner/admin-only exactly as before.
 */
export async function setCommunityMuted(communityId, uid, muted) {
  if (!uid) throw new Error('You need to be signed in.')
  await updateDoc(memberDocRef(communityId, uid), { muted: Boolean(muted) })
}

export async function transferOwnership(communityId, currentOwnerUid, newOwnerUid) {
  await runTransaction(db, async (transaction) => {
    const communitySnap = await transaction.get(communityDocRef(communityId))
    if (!communitySnap.exists()) throw new Error('Community not found.')
    if (communitySnap.data().ownerId !== currentOwnerUid) {
      throw new Error('Only the current owner can transfer ownership.')
    }
    const newOwnerMemberSnap = await transaction.get(memberDocRef(communityId, newOwnerUid))
    if (!newOwnerMemberSnap.exists()) {
      throw new Error('The new owner must already be a member.')
    }

    transaction.update(communityDocRef(communityId), { ownerId: newOwnerUid })
    transaction.update(memberDocRef(communityId, newOwnerUid), { role: 'owner' })
    transaction.update(memberDocRef(communityId, currentOwnerUid), { role: 'admin' })
  })
}

/**
 * Full cascading delete, owner-only:
 *  - communities/{id} and communityHandles/{handle} — deleted directly.
 *  - communityMembers/communityRequests for this community — queried
 *    and batch-deleted (possible client-side because both are
 *    top-level collections with a communityId field, not
 *    subcollections — no Cloud Function needed for THESE, unlike the
 *    earlier-flagged gap when the schema was still subcollection-based).
 *  - posts with this communityId — NOT deleted, per this message's
 *    explicit instruction. Batch-updated with communityDeleted: true
 *    instead; PostCard.jsx would need its own check for that field to
 *    actually show "Community no longer exists" — that UI change isn't
 *    included here, only the data-side flag it would read.
 *  - coverImage/icon in Storage — deleted via deleteObject if either
 *    URL looks like a real Firebase Storage download URL. Wrapped so a
 *    failure here (e.g. the URL isn't actually a Storage URL, or the
 *    object's already gone) doesn't abort the rest of the deletion.
 *
 * Batched writes are capped at 500 operations per Firestore batch;
 * chunks the members/requests/posts cleanup accordingly rather than
 * assuming any community stays under that limit forever.
 */
export async function deleteCommunity(communityId, ownerUid) {
  const communitySnap = await getDoc(communityDocRef(communityId))
  if (!communitySnap.exists()) return
  const community = communitySnap.data()
  if (community.ownerId !== ownerUid) {
    throw new Error('Only the owner can delete this community.')
  }

  async function batchDeleteQuery(collectionQuery) {
    const snap = await getDocs(collectionQuery)
    const docs = snap.docs
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db)
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }

  await batchDeleteQuery(query(collection(db, 'communityMembers'), where('communityId', '==', communityId)))
  await batchDeleteQuery(query(collection(db, 'communityRequests'), where('communityId', '==', communityId)))

  const postsSnap = await getDocs(query(collection(db, 'posts'), where('communityId', '==', communityId)))
  for (let i = 0; i < postsSnap.docs.length; i += 450) {
    const batch = writeBatch(db)
    postsSnap.docs.slice(i, i + 450).forEach((d) => batch.update(d.ref, { communityDeleted: true }))
    await batch.commit()
  }

  for (const url of [community.coverImage, community.icon]) {
    if (!url) continue
    try {
      await deleteObject(ref(getStorage(), url))
    } catch {
      // URL wasn't a real Storage object, or it's already gone — the
      // rest of the deletion still needs to complete regardless.
    }
  }

  await deleteDoc(doc(db, 'communityHandles', community.handle))
  await deleteDoc(communityDocRef(communityId))
}

/**
 * Edits community details — owner or admin. Restricted to exactly the
 * fields the security rules' admin-update branch allows
 * (description/coverImage/icon/tags/rules) plus name/type/privacy,
 * which only the OWNER can change per the rules (the admin branch's
 * hasOnly() list doesn't include them) — enforced here by checking
 * isOwner before allowing those specific fields through, so a
 * non-owner admin gets a clear error instead of a confusing Firestore
 * permission-denied.
 */
export async function updateCommunityDetails(communityId, uid, updates) {
  const communitySnap = await getDoc(communityDocRef(communityId))
  if (!communitySnap.exists()) throw new Error('Community not found.')
  const community = communitySnap.data()
  const isOwner = community.ownerId === uid
  const isAdmin = isOwner || (community.admins || []).includes(uid)
  if (!isAdmin) throw new Error('Only the owner or an admin can edit this community.')

  const ownerOnlyFields = ['name', 'type', 'privacy']
  const attemptedOwnerOnly = ownerOnlyFields.filter((field) => field in updates)
  if (attemptedOwnerOnly.length > 0 && !isOwner) {
    throw new Error('Only the owner can change name, type, or privacy.')
  }

  await updateDoc(communityDocRef(communityId), updates)
}

/** Uploads a cover image or icon to Storage, returns its download URL. Path includes a timestamp so re-uploading doesn't silently overwrite a still-referenced old file before the community doc is updated. */
export async function uploadCommunityAsset(communityId, file, kind) {
  const storage = getStorage()
  const path = `communities/${communityId}/${kind}-${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

/** Discover queries — each a simple, indexed query, not a combined "smart" one. */
export async function getTrendingCommunities({ pageSize = 20 } = {}) {
  const snap = await getDocs(query(collection(db, 'communities'), orderBy('membersCount', 'desc'), limit(pageSize)))
  return snap.docs.map(mapCommunityDoc)
}

export async function getNewestCommunities({ pageSize = 20 } = {}) {
  const snap = await getDocs(query(collection(db, 'communities'), orderBy('createdAt', 'desc'), limit(pageSize)))
  return snap.docs.map(mapCommunityDoc)
}

export async function getCollegeCommunities(collegeId, { pageSize = 30 } = {}) {
  const snap = await getDocs(
    query(collection(db, 'communities'), where('collegeId', '==', collegeId), orderBy('membersCount', 'desc'), limit(pageSize))
  )
  return snap.docs.map(mapCommunityDoc)
}

/**
 * Search is client-filtered prefix matching on name/handle, same
 * pragmatic tradeoff most Firestore apps make without Algolia/
 * Typesense wired in — Firestore has no native full-text search.
 * Tags/category are exact-match `where` queries, which Firestore DOES
 * support natively, so those two run server-side.
 */
export async function searchCommunitiesByName(term, { pageSize = 200, resultLimit = 20 } = {}) {
  const normalized = term.trim().toLowerCase()
  if (!normalized) return []
  const snap = await getDocs(query(collection(db, 'communities'), limit(pageSize)))
  return snap.docs
    .map(mapCommunityDoc)
    .filter(
      (community) =>
        community.name.toLowerCase().includes(normalized) || community.handle.toLowerCase().includes(normalized)
    )
    .slice(0, resultLimit)
}

export async function searchCommunitiesByTag(tag, { pageSize = 20 } = {}) {
  const snap = await getDocs(
    query(collection(db, 'communities'), where('tags', 'array-contains', tag), limit(pageSize))
  )
  return snap.docs.map(mapCommunityDoc)
}

export async function searchCommunitiesByCategory(type, { pageSize = 20 } = {}) {
  if (!COMMUNITY_TYPES.includes(type)) return []
  const snap = await getDocs(query(collection(db, 'communities'), where('type', '==', type), limit(pageSize)))
  return snap.docs.map(mapCommunityDoc)
}

/** Joined/owned/created communities for a profile — three separate, cheap queries. */
export async function getUserPendingRequests(uid) {
  if (!uid) return []
  const snap = await getDocs(
    query(collection(db, 'communityRequests'), where('uid', '==', uid), where('status', '==', 'pending'))
  )
  return snap.docs.map((d) => d.data())
}

export async function getUserCommunityMemberships(uid) {
  const snap = await getDocs(query(collection(db, 'communityMembers'), where('uid', '==', uid)))
  return snap.docs.map((d) => d.data())
}

export async function getOwnedCommunities(uid) {
  const snap = await getDocs(query(collection(db, 'communities'), where('ownerId', '==', uid)))
  return snap.docs.map(mapCommunityDoc)
}

/**
 * Community posts now live in the shared posts/ collection (createPost
 * in postService.js is the actual write path — CreatePostPage.jsx
 * calls it directly with communityId/communityName folded into its
 * existing `extra` param, since that function already accepts one for
 * category/isAnonymous). This service only reads them back, scoped to
 * one community, for CommunityDetailPage's Posts and Media tabs.
 *
 * I don't have postService.js's real source, so I can't verify its
 * getFeedPosts (or equivalent) already supports filtering by
 * communityId — if it doesn't, this query and that function will need
 * to agree on how communityId is actually stored on a post doc.
 * Written here assuming a flat `communityId` field, matching what this
 * message specifies posts should store.
 */
/**
 * Reuses postService.js's own mapPostDoc — the same translation layer
 * getFeedPosts()/getUserPosts() use — so a community post renders
 * through PostCard exactly like a Home-feed post (poll included: PostCard
 * already renders PostPoll whenever post.poll is present, so a poll
 * created via the normal composer and posted into a community shows up
 * directly in this feed, no separate handling needed). Previously this
 * returned raw, unmapped doc data, which is why CommunityDetailPage.jsx
 * could never actually use PostCard here and had to hand-roll a much
 * more limited list instead.
 */
/**
 * `channelId` is optional — omitted (the default), this returns the
 * community's WHOLE feed across every channel, same as before channels
 * existed; passed, it narrows to just that channel via a real `where`
 * clause (not a client-side filter), same as the existing communityId
 * scoping. Two equality filters + orderBy on a third field needs a
 * Firestore composite index — same one-time-setup situation every other
 * multi-filter query in this file already documents (Firestore's own
 * error includes a direct console link the first time this runs for
 * real with a channelId filter).
 */
export async function getCommunityFeedPosts(communityId, currentUid, { pageSize = 20, cursor = null, channelId = null } = {}) {
  const constraints = [where('communityId', '==', communityId)]
  if (channelId) constraints.push(where('channelId', '==', channelId))
  constraints.push(orderBy('createdAt', 'desc'), limit(pageSize))
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(collection(db, 'posts'), ...constraints))
  return {
    posts: snap.docs.map((d) => mapPostDoc(d, currentUid)),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/** Media tab — same query, filtered client-side to posts that have an image. Firestore can't combine an equality filter with an existence filter on a different field without a composite index; client-side filtering on top of the already-scoped community query avoids requiring one for this one tab. */
export async function getCommunityMediaPosts(communityId, currentUid, { pageSize = 60 } = {}) {
  const { posts } = await getCommunityFeedPosts(communityId, currentUid, { pageSize })
  return posts.filter((post) => Boolean(post.imagePreviewUrl))
}

/** Live subscription for a community's member count / core fields — used by the club page header. */
export function subscribeToCommunity(communityId, callback) {
  return onSnapshot(communityDocRef(communityId), (snap) => {
    callback(snap.exists() ? mapCommunityDoc(snap) : null)
  })
}
