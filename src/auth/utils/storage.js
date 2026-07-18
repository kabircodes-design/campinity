import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../../firebase/firebase.js'

/** Uploads a profile photo to profileImages/{uid} and returns its public download URL. */
export async function uploadProfileImage(uid, file) {
  const fileRef = ref(storage, `profileImages/${uid}`)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}

/** Uploads a college ID card image to studentIds/{uid} and returns its public download URL. */
export async function uploadStudentId(uid, file) {
  const fileRef = ref(storage, `studentIds/${uid}`)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
} 