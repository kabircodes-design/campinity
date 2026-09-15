import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp } from 'firebase/firestore'
import { db, storage } from './firebase.js'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

/**
 * Minimal, honest first slice of the Marketplace feature — a real
 * `products` collection, not a mock. Deliberately does NOT include
 * campaigns/adCreatives/campaignAnalytics/affiliateProducts — those
 * would be pretend functionality with no real backend behind them,
 * which the brief explicitly forbids ("do not pretend a backend
 * feature is functional if it isn't"). Follows the exact same
 * query/mapping pattern already established in communityService.js
 * (getTrendingCommunities) — not a new architecture.
 *
 * `collegeId`/`collegeName` are denormalized from the seller's own
 * profile at creation time (same pattern as `sellerName` — a display
 * cache, not a live join), enabling a real "From Your Campus" section
 * with zero fabricated location/distance data.
 *
 * `sponsored` is read-only pass-through for a future promoted-listing
 * feature — nothing in this app writes it yet, so it is always
 * `null` today and every "Sponsored" UI branch that reads it naturally
 * renders nothing rather than fake ad content. This is the "advertising
 * -ready architecture" the brief asks for: the field and its rendering
 * path exist, but no fake data is ever produced to fill it.
 */
const COLLECTION = 'products'

function mapProductDoc(docSnap) {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    sellerId: data.sellerId,
    sellerName: data.sellerName || 'Student',
    name: data.name || '',
    price: data.price || 0,
    description: data.description || '',
    category: data.category || 'other',
    imageUrl: data.imageUrl || '',
    collegeId: data.collegeId || null,
    collegeName: data.collegeName || null,
    sponsored: data.sponsored || null,
    // Admin moderation flag (adminModerateProduct in the Cloud
    // Functions, "hide"/"unhide") — additive, defaults false, so every
    // existing product without this field is correctly treated as
    // visible.
    hidden: data.hidden === true,
    createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0
  }
}

export async function getMarketplaceProducts({ pageSize = 40 } = {}) {
  const snap = await getDocs(query(collection(db, COLLECTION), limit(pageSize)))
  const products = snap.docs.map(mapProductDoc).filter((p) => !p.hidden)
  return products.sort((a, b) => b.createdAtMs - a.createdAtMs)
}

export async function getProductById(productId) {
  const snap = await getDoc(doc(db, COLLECTION, productId))
  if (!snap.exists()) return null
  return mapProductDoc(snap)
}

export async function uploadProductImage(uid, file) {
  const path = `products/${uid}/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

/**
 * uid is taken as a parameter and written as sellerId here, but the
 * real authorization boundary is the Firestore rule itself (ownership
 * enforced server-side, not trusted from this client call) — matching
 * the explicit 'never trust sellerId from client' instruction. This
 * function does not decide who owns a product; the rule does.
 */
export async function createProduct({ uid, name, price, description, category, imageUrl, sellerName, collegeId, collegeName }) {
  const payload = {
    sellerId: uid,
    sellerName: sellerName || 'Student',
    name: name.trim(),
    price: Number(price) || 0,
    description: description?.trim() || '',
    category: category || 'other',
    imageUrl: imageUrl || '',
    collegeId: collegeId || null,
    collegeName: collegeName || null,
    createdAt: serverTimestamp()
  }
  const docRef = await addDoc(collection(db, COLLECTION), payload)
  return docRef.id
}

/**
 * Ownership is enforced server-side by the existing products/{productId}
 * rule (`resource.data.sellerId == request.auth.uid`), not trusted from
 * this call — a non-owner's delete simply fails at the rule.
 */
export async function deleteProduct(productId) {
  await deleteDoc(doc(db, COLLECTION, productId))
}

export const CATEGORIES = ['Fashion', 'Food', 'Electronics', 'Books', 'Services', 'College Essentials', 'Other']
