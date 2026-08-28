/**
 * Lost & Found service — follows the exact same patterns already
 * established in communityService.js and engagementService.js:
 * modular Firestore SDK, a single top-level collection
 * (lostFound/{itemId}), transactions only where an atomic multi-doc
 * update is genuinely needed (resolving an item), plain
 * getDocs/query for everything else.
 *
 * Schema (lostFound/{itemId}):
 *   type: 'lost' | 'found'
 *   title, category, description, location: string
 *   dateOccurred: Timestamp
 *   timeOccurred: string (free text, e.g. "around 3pm")
 *   imageUrl, imagePath: string | null
 *   createdBy: uid
 *   createdAt, updatedAt: Timestamp
 *   status: 'active' | 'resolved'
 *   resolvedAt: Timestamp | null
 *   resolvedBy: uid | null
 *
 * Image upload reuses the exact same Firebase Storage SDK pattern
 * already used by uploadCommunityAsset (communityService.js) — ref() +
 * uploadBytes() + getDownloadURL() — under a new lostFound/{uid}/...
 * path, matching the brief's 'do not invent a second upload system'
 * instruction as closely as possible without a real existing
 * lostFound-specific path to reuse (none existed before this feature).
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where
} from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { db } from './firebase.js'

export const LOST_FOUND_CATEGORIES = [
  'Electronics',
  'Documents',
  'Keys',
  'Wallet',
  'ID Card',
  'Clothing',
  'Books',
  'Accessories',
  'Bags',
  'Other'
]

export const LOST_FOUND_LOCATIONS = [
  'Library',
  'Cafeteria',
  'Main Gate',
  'Hostel',
  'Auditorium',
  'Parking',
  'Sports Ground',
  'Classroom',
  'Other'
]

function itemDoc(itemId) {
  return doc(db, 'lostFound', itemId)
}

function mapItemDoc(docSnap) {
  const data = docSnap.data()
  return { id: docSnap.id, ...data }
}

/**
 * Creates a lost/found listing. createdBy is always set to the real
 * authenticated uid passed in — never trusted from anywhere else,
 * matching 'do not trust client-supplied ownership information.'
 */
export async function createLostFoundItem({
  uid,
  type,
  title,
  category,
  description,
  location,
  dateOccurred,
  timeOccurred = '',
  imageUrl = null,
  imagePath = null
}) {
  if (!uid) throw new Error('You need to be signed in to post a listing.')
  if (type !== 'lost' && type !== 'found') throw new Error('Invalid listing type.')
  if (!title?.trim()) throw new Error('Item name is required.')
  if (!category) throw new Error('Category is required.')
  if (!location) throw new Error('Location is required.')

  const docRef = await addDoc(collection(db, 'lostFound'), {
    type,
    title: title.trim(),
    category,
    description: description?.trim() || '',
    location,
    dateOccurred: dateOccurred || serverTimestamp(),
    timeOccurred: timeOccurred?.trim() || '',
    imageUrl,
    imagePath,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'active',
    resolvedAt: null,
    resolvedBy: null
  })

  return docRef.id
}

/**
 * Paginated listing fetch — client-side filtering for type/category/
 * location/search, matching the same pragmatic tradeoff
 * communityService.js's searchCommunitiesByName already makes
 * (Firestore has no native full-text search). status is the only
 * server-side `where` filter, since it's the one field every caller
 * of this function actually wants scoped before pagination.
 */
export async function getLostFoundItems({ status = 'active', pageSize = 20, cursor = null } = {}) {
  const constraints = [where('status', '==', status), orderBy('createdAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(collection(db, 'lostFound'), ...constraints))
  return {
    items: snap.docs.map(mapItemDoc),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

export async function getLostFoundItem(itemId) {
  const snap = await getDoc(itemDoc(itemId))
  if (!snap.exists()) return null
  return mapItemDoc(snap)
}

/** Owner-only field update — mirrors editPost's authorization shape in engagementService.js. */
export async function updateLostFoundItem(itemId, uid, updates) {
  const snap = await getDoc(itemDoc(itemId))
  if (!snap.exists()) throw new Error('This listing no longer exists.')
  if (snap.data().createdBy !== uid) throw new Error('You can only edit your own listing.')

  await updateDoc(itemDoc(itemId), { ...updates, updatedAt: serverTimestamp() })
}

/**
 * Marks an item resolved — owner-only, via transaction so status/
 * resolvedAt/resolvedBy always change together atomically, never
 * leaving a half-resolved state if a write partially failed.
 */
export async function resolveLostFoundItem(itemId, uid) {
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(itemDoc(itemId))
    if (!snap.exists()) throw new Error('This listing no longer exists.')
    if (snap.data().createdBy !== uid) throw new Error('You can only resolve your own listing.')
    if (snap.data().status === 'resolved') return

    transaction.update(itemDoc(itemId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
      resolvedBy: uid,
      updatedAt: serverTimestamp()
    })
  })
}

export async function deleteLostFoundItem(itemId, uid) {
  const snap = await getDoc(itemDoc(itemId))
  if (!snap.exists()) return
  if (snap.data().createdBy !== uid) throw new Error('You can only delete your own listing.')
  await deleteDoc(itemDoc(itemId))
}

/** Recently resolved — for the 'Reunited on Campus' section. Same status='resolved' filter, ordered by resolvedAt instead of createdAt. */
export async function getRecentlyResolvedItems({ pageSize = 5 } = {}) {
  const snap = await getDocs(
    query(collection(db, 'lostFound'), where('status', '==', 'resolved'), orderBy('resolvedAt', 'desc'), limit(pageSize))
  )
  return snap.docs.map(mapItemDoc)
}

/** Uploads a listing image to Storage, returns { url, path } — same ref()+uploadBytes()+getDownloadURL() pattern as uploadCommunityAsset. */
export async function uploadLostFoundImage(uid, file) {
  if (!uid) throw new Error('You need to be signed in to upload an image.')
  const storage = getStorage()
  const path = `lostFound/${uid}/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return { url, path }
}
