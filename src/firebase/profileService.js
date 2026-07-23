import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase.js'
import { getUserIdByUsername, ensureUsernameReservation } from './usernameService.js'

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
    coverPhoto: data.coverPhoto ?? '',
    verifiedCampus: data.verifiedCampus ?? false,
    followersCount: data.followersCount ?? 0,
    followingCount: data.followingCount ?? 0,
    skills: Array.isArray(data.skills) ? data.skills : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
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
      coverPhoto: data.coverPhoto ?? '',
      verifiedCampus: data.verifiedCampus ?? false,
      skills: Array.isArray(data.skills) ? data.skills : [],
      interests: Array.isArray(data.interests) ? data.interests : [],
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

export async function getUserProfileByUsername(username) {
  const uid = await getUserIdByUsername(username)
  if (!uid) return null

  const profile = await getUserProfile(uid)
  if (!profile) return null

  return { uid, ...profile }
}