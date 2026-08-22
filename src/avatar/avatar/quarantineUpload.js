/**
 * Uploads a cropped profile-photo blob to a QUARANTINE Storage path —
 * never the final public campusAvatars/{uid}/... path. This is the
 * insertion point requirement 6 asks for: "do not publish an
 * unmoderated upload directly to the final public Storage path."
 *
 * I don't have avatarStorage.js (the file with the real
 * uploadCampusAvatar implementation ProfilePhotoEditor.jsx already
 * uses), so this is a new, separate function rather than a
 * modification of that unseen file — but it follows the exact same
 * Firebase Storage SDK pattern already used elsewhere in this project
 * (uploadCommunityAsset in communityService.js: ref() + uploadBytes()
 * + getDownloadURL()), not an invented convention.
 *
 * The quarantine path is scoped under the uploading user's own uid
 * (quarantine/profilePhotos/{uid}/{timestamp}.jpg) so
 * moderateProfilePhoto's own uid-prefix check in the Cloud Function
 * can verify ownership before processing it.
 */
import { getStorage, ref, uploadBytes } from 'firebase/storage'

export async function uploadToQuarantine(uid, blob) {
  if (!uid) throw new Error('You need to be signed in to upload a photo.')
  const storage = getStorage()
  const path = `quarantine/profilePhotos/${uid}/${Date.now()}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob)
  return path
}
