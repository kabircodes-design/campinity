/**
 * Mute service — user-level and community-level mute. Conversation-
 * level mute already exists (chatService.js's toggleMuteChat, reused
 * here for nothing — it's a separate, already-complete feature, not
 * duplicated). Mute is explicitly NOT block: muting reduces
 * visibility/notifications without restricting the other person's
 * ability to interact, matching "Mute is NOT Block" from the brief.
 *
 * Schema mirrors the ALREADY-SECURED blockedUsers pattern exactly
 * (users/{uid}/mutedUsers/{mutedUid}, users/{uid}/mutedCommunities/
 * {communityId}) — private subcollections under the muter's own user
 * document, owner-only in every direction. This requires a rules
 * addition (these collections don't exist in firestore.rules yet) —
 * see the accompanying rules diff, added as new match blocks
 * following the exact same shape as the existing blockedUsers rule,
 * not a new pattern invented independently.
 */
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

function mutedUserDoc(muterUid, targetUid) {
  return doc(db, 'users', muterUid, 'mutedUsers', targetUid)
}
function mutedCommunityDoc(muterUid, communityId) {
  return doc(db, 'users', muterUid, 'mutedCommunities', communityId)
}

export async function muteUser(muterUid, targetUid) {
  if (!muterUid) throw new Error('You need to be signed in.')
  if (muterUid === targetUid) throw new Error("You can't mute yourself.")
  await setDoc(mutedUserDoc(muterUid, targetUid), { mutedUid: targetUid, createdAt: serverTimestamp() })
}

export async function unmuteUser(muterUid, targetUid) {
  if (!muterUid) throw new Error('You need to be signed in.')
  await deleteDoc(mutedUserDoc(muterUid, targetUid))
}

export async function isUserMuted(viewerUid, targetUid) {
  if (!viewerUid || !targetUid) return false
  const snap = await getDoc(mutedUserDoc(viewerUid, targetUid))
  return snap.exists()
}

export async function getMutedUsers(uid) {
  if (!uid) return []
  const snap = await getDocs(collection(db, 'users', uid, 'mutedUsers'))
  return snap.docs.map((d) => d.data())
}

export async function muteCommunity(muterUid, communityId) {
  if (!muterUid) throw new Error('You need to be signed in.')
  await setDoc(mutedCommunityDoc(muterUid, communityId), { communityId, createdAt: serverTimestamp() })
}

export async function unmuteCommunity(muterUid, communityId) {
  if (!muterUid) throw new Error('You need to be signed in.')
  await deleteDoc(mutedCommunityDoc(muterUid, communityId))
}

export async function isCommunityMuted(uid, communityId) {
  if (!uid || !communityId) return false
  const snap = await getDoc(mutedCommunityDoc(uid, communityId))
  return snap.exists()
}

export async function getMutedCommunities(uid) {
  if (!uid) return []
  const snap = await getDocs(collection(db, 'users', uid, 'mutedCommunities'))
  return snap.docs.map((d) => d.data())
}
