import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase.js'

const COLLECTION = 'posts'

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-600'
]

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

/** Deterministic so the same author always gets the same avatar color. */
function getAvatarColor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatTimeAgo(timestamp) {
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
 * `type` is always 'general' since this schema has no category field yet
 * — 'general' is the one type PostCard can render with zero risk (no
 * specialized preview block, always present in postTypeConfig).
 * `feedCategories` is always ['forYou'] for the same reason — real posts
 * only appear under the default "For You" tab until real categorization
 * exists.
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
 * Loads a single user's posts, newest first. Not called by the Home Feed
 * yet — kept ready for the Profile "Posts" tab / future reconnection.
 */
export async function getUserPosts(userId, currentUid, maxResults = 50) {
  const postsQuery = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(postsQuery)
  return snap.docs.map((docSnap) => mapPostDoc(docSnap, currentUid))
}