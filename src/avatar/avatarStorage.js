import { deleteObject, getStorage, getDownloadURL, ref, uploadBytes } from 'firebase/storage'

/**
 * Reuses the exact same getStorage/ref/uploadBytes/getDownloadURL
 * pattern already established in communityService.js — not a new
 * upload utility. Path: campusAvatars/{uid}/{timestamp}.jpg — a
 * timestamp per upload (not a fixed filename) so regenerating an
 * avatar doesn't require deleting the old file first for the new
 * upload to succeed, and so a failed delete of an old avatar never
 * blocks saving a new one.
 */
export async function uploadCampusAvatar(uid, imageBlob) {
  if (!uid) throw new Error('You need to be signed in.')
  const storage = getStorage()
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
    await deleteObject(ref(getStorage(), url))
  } catch {
    // Orphaned file, not a blocking failure — same reasoning already
    // established in communityService.js for equivalent cleanup.
  }
}
