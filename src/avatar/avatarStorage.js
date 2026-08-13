import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase/firebase.js'

/**
 * Reuses the exact same ref/uploadBytes/getDownloadURL pattern
 * already established in communityService.js — not a new upload
 * utility. Path: campusAvatars/{uid}/{timestamp}.jpg — a timestamp
 * per upload (not a fixed filename) so regenerating an avatar doesn't
 * require deleting the old file first for the new upload to succeed,
 * and so a failed delete of an old avatar never blocks saving a new
 * one.
 *
 * Root-cause candidate fix: this file previously called getStorage()
 * fresh with no arguments, instead of importing the shared, already-
 * initialized `storage` export every other Storage-using service in
 * this codebase uses (postService.js, storyService.js, chatService.js,
 * verificationService.js all import { storage } from firebase.js).
 * Found via direct comparison across files, not assumed — now
 * consistent with the established pattern.
 */
export async function uploadCampusAvatar(uid, imageBlob) {
  if (!uid) throw new Error('You need to be signed in.')
  const path = `campusAvatars/${uid}/${Date.now()}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, imageBlob)
  return getDownloadURL(storageRef)
}

/**
 * Best-effort delete of a previous avatar file — failures are
 * swallowed (matching communityService.js's own established pattern
 * for cleanup deletes) since an old orphaned Storage file is a much
 * smaller problem than blocking the user's actual action on a
 * cleanup step that isn't essential to it.
 */
export async function deleteCampusAvatarFile(url) {
  if (!url) return
  try {
    await deleteObject(ref(storage, url))
  } catch {
    // Orphaned file, not a blocking failure — same reasoning already
    // established in communityService.js for equivalent cleanup.
  }
}
