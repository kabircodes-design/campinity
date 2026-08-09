import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase.js'

/**
 * users/{uid}/blockedUsers/{blockedUid} — fully private to the
 * blocker (see firestore.rules: the blocked person can never read
 * this, not even their own entry, so they can't detect the block and
 * route around it). Doc id IS the blocked uid, matching this
 * project's established "doc id as the uniqueness/ownership lock"
 * pattern (savedPosts, usernames, colleges) — blocking the same
 * person twice just overwrites the same doc.
 */
export async function blockUser(uid, blockedUid) {
  if (!uid || !blockedUid) return
  await setDoc(doc(db, 'users', uid, 'blockedUsers', blockedUid), {
    blockedAt: serverTimestamp()
  })
}

export async function unblockUser(uid, blockedUid) {
  if (!uid || !blockedUid) return
  await deleteDoc(doc(db, 'users', uid, 'blockedUsers', blockedUid))
}

/** Used to show/hide the Block vs Unblock action on a profile. */
export async function isBlocking(uid, otherUid) {
  if (!uid || !otherUid) return false
  const snap = await getDoc(doc(db, 'users', uid, 'blockedUsers', otherUid))
  return snap.exists()
}

/** For the Safety Center's blocked-accounts list. */
export async function getBlockedUsers(uid) {
  if (!uid) return []
  const snap = await getDocs(collection(db, 'users', uid, 'blockedUsers'))
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}
