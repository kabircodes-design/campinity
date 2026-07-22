import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'

const COLLECTION = 'posts'

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-600'
]

export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

/** Deterministic so the same author always gets the same avatar color. */
export function getAvatarColor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function formatTimeAgo(timestamp) {
  if (!timestamp?.toDate) return 'Just now'
  const diffMs = Date.now() - timestamp.toDate().getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

/**
 * Maps a Firestore posts/{id} document into the exact shape PostCard.jsx
 * already expects (type, name, avatarColor, time, likes, comments,
 * feedCategories, ...) — the ONLY translation layer between Firestore's
 * schema and the existing, untouched PostCard component.
 *
 * `type` is always 'general' since this schema has no category field
 * PostCard knows how to render yet — 'general' is the one type PostCard
 * can render with zero risk (no specialized preview block, always
 * present in postTypeConfig). `feedCategories` is always ['forYou'] for
 * the same reason.
 */
function mapPostDoc(docSnap, currentUid) {
  const data = docSnap.data()
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : []

  return {
    id: docSnap.id,
    type: 'general',
    name: data.displayName || 'Student',
    username: data.username || '',
    initials: getInitials(data.displayName),
    avatarColor: getAvatarColor(data.userId || data.displayName || docSnap.id),
    department: '',
    year: '',
    college: '',
    time: formatTimeAgo(data.createdAt),
    text: data.text || '',
    imagePreviewUrl: data.image || undefined,
    likes: data.likesCount || 0,
    comments: data.commentsCount || 0,
    likedByMe: currentUid ? likedBy.includes(currentUid) : false,
    feedCategories: ['forYou']
  }
}

/**
 * Loads the public Home Feed, newest first.
 *
 * NOTE: this query combines an equality filter (visibility) with an
 * orderBy on a different field (createdAt), which requires a Firestore
 * composite index. The first time this runs against a real project,
 * Firestore's error will include a direct link to auto-create it in the
 * console — that one-time setup step can't be done from application code.
 *
 * `currentUid` is optional and only used to compute each post's initial
 * `likedByMe` display value — liking itself isn't implemented yet
 * (display only, per current scope).
 */
export async function getFeedPosts(currentUid, maxResults = 50) {
  const postsQuery = query(
    collection(db, COLLECTION),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(postsQuery)
  return snap.docs.map((docSnap) => mapPostDoc(docSnap, currentUid))
}

/**
 * Loads a single user's posts, newest first. Used by Profile's Posts tab.
 *
 * Includes the same `visibility == 'public'` filter Home Feed's query
 * uses. This isn't optional: Firestore security rules require that a
 * list/collection query be structurally provable to only ever return
 * documents the rule allows — for our rules (`resource.data.visibility
 * == 'public'`), that means the query itself must filter on visibility,
 * not just rely on every matching document happening to have that value.
 * A userId-only query has no such guarantee from Firestore's point of
 * view, so it was rejected outright with "Missing or insufficient
 * permissions" regardless of the actual document contents. Two equality
 * filters on different fields (userId, visibility) don't require a
 * composite index, so this stays index-free — sorting still happens
 * client-side below rather than via orderBy, for the same reason noted
 * on the composite-index issue this replaced.
 */
export async function getUserPosts(userId, currentUid, maxResults = 50) {
  const postsQuery = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('visibility', '==', 'public'),
    limit(maxResults)
  )
  const snap = await getDocs(postsQuery)
  const sortedDocs = [...snap.docs].sort((a, b) => {
    const aTime = a.data().createdAt?.toMillis?.() ?? 0
    const bTime = b.data().createdAt?.toMillis?.() ?? 0
    return bTime - aTime
  })
  return sortedDocs.map((docSnap) => mapPostDoc(docSnap, currentUid))
}

/**
 * Loads a single post by its Firestore document id — used by
 * PostDetailPage.jsx. Returns null if the document doesn't exist.
 */
export async function getPostById(postId, currentUid) {
  const snap = await getDoc(doc(db, COLLECTION, postId))
  if (!snap.exists()) return null
  return mapPostDoc(snap, currentUid)
}

/**
 * Uploads a Create Post image to Storage and returns its public download
 * URL. Path is namespaced per-user and timestamped so re-uploads never
 * collide.
 */
export async function uploadPostImage(uid, file) {
  const path = `postImages/${uid}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}

/**
 * Creates a new posts/{id} document.
 *
 * `author` carries the fields the feed needs to render the post
 * immediately: { displayName, username, profilePhoto }. `extra` accepts
 * additional, non-required fields (category, isAnonymous) so the
 * existing Create Post UI's category selector and anonymous toggle keep
 * writing somewhere meaningful even though they're not part of the
 * required schema — mapPostDoc() doesn't read them yet, so they don't
 * affect how the post renders today, but the data isn't silently lost.
 *
 * Returns the new document's id.
 */
export async function createPost({ uid, text, imageUrl, author, extra = {} }) {
  const payload = {
    userId: uid,
    displayName: author.displayName || '',
    username: author.username || '',
    profilePhoto: author.profilePhoto || '',
    text: text || '',
    image: imageUrl || null,
    visibility: 'public',
    likesCount: 0,
    commentsCount: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
    ...extra
  }
  const docRef = await addDoc(collection(db, COLLECTION), payload)
  return docRef.id
}