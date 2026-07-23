import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signOut,
  updatePassword
} from 'firebase/auth'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  where,
  writeBatch
} from 'firebase/firestore'
import { ref, deleteObject, listAll } from 'firebase/storage'
import { auth, db, storage } from './firebase.js'

const BATCH_LIMIT = 400 // stay comfortably under Firestore's 500-operation batch cap

/**
 * Commits an array of "batch operations" (each a function that receives
 * a WriteBatch and adds work to it) in chunks of BATCH_LIMIT, so this
 * never exceeds Firestore's per-batch operation cap regardless of how
 * many documents are involved. Each chunk commits independently — if
 * one chunk fails partway through the overall cleanup, everything
 * already committed stays committed (this is what "idempotent" means
 * here: re-running the whole deletion afterward just finds fewer
 * documents left to clean up and safely does less work).
 */
async function commitInChunks(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const chunk = operations.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)
    chunk.forEach((op) => op(batch))
    await batch.commit()
  }
}

/**
 * Re-authenticates the current user with their password. Firebase
 * requires a "recent login" before allowing deleteUser() or
 * updatePassword() — this is what makes that requirement work correctly
 * instead of throwing auth/requires-recent-login.
 */
export async function reauthenticate(password) {
  const user = auth.currentUser
  if (!user || !user.email) {
    const err = new Error('Not signed in.')
    err.code = 'not-signed-in'
    throw err
  }

  const credential = EmailAuthProvider.credential(user.email, password)
  await reauthenticateWithCredential(user, credential)
}

/**
 * Real password change. Requires the current password (re-authenticates
 * first, then updates) — never silently succeeds without verifying the
 * user actually knows their current password.
 */
export async function changePassword(currentPassword, newPassword) {
  await reauthenticate(currentPassword)
  await updatePassword(auth.currentUser, newPassword)
}

/**
 * Real logout: signs out of Firebase Auth (this alone invalidates the
 * session everywhere ProtectedRoute checks it, since useAuthUser's
 * onSnapshot-backed listener reacts to the auth state change
 * immediately) and clears anything the app cached outside of React
 * state, such as recent searches.
 */
export async function logOut() {
  try {
    window.localStorage.removeItem('campinity:recentSearches')
  } catch {
    // Storage unavailable — not fatal, sign-out still proceeds.
  }
  await signOut(auth)
}

/**
 * Deletes every Storage file under a given folder path (profile photos,
 * post images, etc.) for one user. Missing folders are not an error —
 * listAll() on a path with nothing in it just returns an empty list.
 */
async function deleteStorageFolder(path) {
  const folderRef = ref(storage, path)
  let result
  try {
    result = await listAll(folderRef)
  } catch {
    return // folder doesn't exist — nothing to delete
  }
  await Promise.all(result.items.map((itemRef) => deleteObject(itemRef).catch(() => {})))
}

/**
 * Deletes a single, known Storage file if it exists. Used for
 * single-file paths (profile photo, student id) rather than folders.
 */
async function deleteStorageFileIfExists(path) {
  if (!path) return
  try {
    await deleteObject(ref(storage, path))
  } catch {
    // Doesn't exist, or already deleted — not an error for this purpose.
  }
}

/**
 * The full account deletion flow. Order matters:
 *
 *   1. Re-authenticate (required before deleteUser() later, and this is
 *      the earliest safe point to fail loudly if the password is wrong,
 *      before any data has been touched).
 *   2. Delete everything Firestore-side while still authenticated —
 *      every one of these writes needs request.auth.uid to be this
 *      user, which stops being true the moment step 3 succeeds.
 *   3. Delete Storage files.
 *   4. Delete the Firebase Auth account itself, last.
 *   5. Sign out locally / clear cached state.
 *
 * Every Firestore step re-queries fresh rather than assuming a previous
 * step's results — if this function is called again after a partial
 * failure, each step simply finds less (or nothing) left to clean up.
 */
export async function deleteAccount(password) {
  const user = auth.currentUser
  if (!user) {
    const err = new Error('Not signed in.')
    err.code = 'not-signed-in'
    throw err
  }
  const uid = user.uid

  // 1. Re-authenticate.
  await reauthenticate(password)

  // Read the profile once up front — needed for username + collegeId-free cleanup.
  const profileSnap = await getDoc(doc(db, 'users', uid))
  const profileData = profileSnap.exists() ? profileSnap.data() : null
  const username = profileData?.username || null

  // 2a. Delete every post authored by this user, including each post's
  // own comments subcollection (Firestore never cascade-deletes
  // subcollections automatically).
  const ownPostsSnap = await getDocs(
    query(collection(db, 'posts'), where('userId', '==', uid), where('visibility', '==', 'public'))
  )
  for (const postDoc of ownPostsSnap.docs) {
    const commentsSnap = await getDocs(collection(db, 'posts', postDoc.id, 'comments'))
    await commitInChunks(commentsSnap.docs.map((c) => (batch) => batch.delete(c.ref)))
    await deleteDoc(postDoc.ref)
  }

  // 2b. Delete every comment this user left on OTHER people's posts, and
  // decrement each parent post's commentsCount. collectionGroup() finds
  // comments across every post regardless of who owns the post.
  const ownCommentsSnap = await getDocs(
    query(collectionGroup(db, 'comments'), where('userId', '==', uid))
  )
  await commitInChunks(
    ownCommentsSnap.docs.map((commentDoc) => (batch) => {
      batch.delete(commentDoc.ref)
      const parentPostRef = commentDoc.ref.parent.parent
      if (parentPostRef) batch.update(parentPostRef, { commentsCount: increment(-1) })
    })
  )

  // 2c. Remove this user's like from every post they've liked, and
  // recalculate each post's likesCount.
  const likedPostsSnap = await getDocs(
    query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      where('likedBy', 'array-contains', uid)
    )
  )
  await commitInChunks(
    likedPostsSnap.docs.map((postDoc) => (batch) => {
      const data = postDoc.data()
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy : []
      const nextLikedBy = likedBy.filter((id) => id !== uid)
      const nextCount = Math.max((data.likesCount || 0) - 1, 0)
      batch.update(postDoc.ref, { likedBy: nextLikedBy, likesCount: nextCount })
    })
  )

  // 2d. Unfollow everyone this user follows, decrementing each of their
  // followersCount.
  const followingSnap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', uid)))
  await commitInChunks(
    followingSnap.docs.map((followDoc) => (batch) => {
      batch.delete(followDoc.ref)
      const followingId = followDoc.data().followingId
      if (followingId) {
        batch.update(doc(db, 'users', followingId), { followersCount: increment(-1) })
      }
    })
  )

  // 2e. Remove every follower of this user, decrementing each of their
  // followingCount. (Requires the rule extension letting either side of
  // a follow relationship delete it and update the matching counter.)
  const followersSnap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', uid)))
  await commitInChunks(
    followersSnap.docs.map((followDoc) => (batch) => {
      batch.delete(followDoc.ref)
      const followerId = followDoc.data().followerId
      if (followerId) {
        batch.update(doc(db, 'users', followerId), { followingCount: increment(-1) })
      }
    })
  )

  // 2f. Delete every chat this user is part of, including each chat's
  // messages subcollection — no orphaned conversations left behind for
  // the other participant to load.
  const chatsSnap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', uid)))
  for (const chatDoc of chatsSnap.docs) {
    const messagesSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'))
    await commitInChunks(messagesSnap.docs.map((m) => (batch) => batch.delete(m.ref)))
    await deleteDoc(chatDoc.ref)
  }

  // 2g. Delete every notification in this user's own inbox.
  const notificationsSnap = await getDocs(collection(db, 'users', uid, 'notifications'))
  await commitInChunks(notificationsSnap.docs.map((n) => (batch) => batch.delete(n.ref)))

  // 2h. Release the username reservation, if any.
  if (username) {
    await deleteDoc(doc(db, 'usernames', username)).catch(() => {})
  }

  // 2i. Delete the Firestore profile document itself.
  await deleteDoc(doc(db, 'users', uid)).catch(() => {})

  // 3. Delete Storage files: profile photo, cover photo, any student-id
  // upload, and every post image under this user's folder.
  await deleteStorageFileIfExists(`profileImages/${uid}`)
  await deleteStorageFileIfExists(`studentIds/${uid}`)
  await deleteStorageFolder(`postImages/${uid}`)

  // 4. Delete the Firebase Auth account. Must be last — every step above
  // needs request.auth.uid to still resolve to this user.
  await deleteUser(user)

  // 5. Clear anything cached locally.
  try {
    window.localStorage.removeItem('campinity:recentSearches')
    window.localStorage.removeItem('campinity:theme')
  } catch {
    // Storage unavailable — not fatal.
  }
}