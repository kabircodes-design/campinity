/**
 * Block service — the client-side half of
 * users/{uid}/blockedUsers/{blockedUid}, already defined and secured
 * in firestore.rules (read directly): read/create/delete are
 * isOwner(uid)-only in every direction, update is always denied. The
 * rules' own comment is explicit about why: "a blocked user must
 * NEVER be able to read this subcollection... that would let them
 * detect they've been blocked." This service never queries or reads
 * anyone's blockedUsers subcollection except the current user's own
 * — there is no function here that could leak block state to the
 * blocked party, matching that requirement structurally, not just by
 * convention.
 *
 * Block + chat interaction is already enforced at the rules layer
 * too — chatIsBlocked() in firestore.rules independently checks both
 * participants' blockedUsers subcollections before allowing a 1-to-1
 * chat to be created or a message sent, so this service doesn't need
 * to duplicate that check to be secure; it's real backend enforcement,
 * not just a UI-hidden button.
 */
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase.js'

function blockedUserDoc(blockerUid, targetUid) {
  return doc(db, 'users', blockerUid, 'blockedUsers', targetUid)
}

export async function blockUser(blockerUid, targetUid) {
  if (!blockerUid) throw new Error('You need to be signed in.')
  if (blockerUid === targetUid) throw new Error("You can't block yourself.")
  await setDoc(blockedUserDoc(blockerUid, targetUid), {
    blockedUid: targetUid,
    createdAt: serverTimestamp()
  })
}

export async function unblockUser(blockerUid, targetUid) {
  if (!blockerUid) throw new Error('You need to be signed in.')
  await deleteDoc(blockedUserDoc(blockerUid, targetUid))
}

/**
 * Checks only the CURRENT user's own block of someone else — never
 * the reverse direction, since the rules make the reverse
 * structurally unreadable anyway (a blocked user cannot read the
 * blocker's list to find out). UI surfaces (profile action menu,
 * community member row) use this to decide whether to show "Block"
 * or "Unblock" for the viewer's own relationship to a target — it
 * cannot and should not be used to show "does this person have me
 * blocked."
 */
export async function isBlockedByMe(viewerUid, targetUid) {
  if (!viewerUid || !targetUid) return false
  const snap = await getDoc(blockedUserDoc(viewerUid, targetUid))
  return snap.exists()
}

/** The current user's own blocked-accounts list — Settings > Privacy & Safety > Blocked accounts. */
export async function getBlockedUsers(uid) {
  if (!uid) return []
  const snap = await getDocs(collection(db, 'users', uid, 'blockedUsers'))
  return snap.docs.map((d) => d.data())
}
