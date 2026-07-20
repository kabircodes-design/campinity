import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase.js'

const COLLECTION = 'stories'

const RING_COLORS = [
  'from-pink-500 via-red-500 to-yellow-500',
  'from-blue-400 via-blue-500 to-indigo-500',
  'from-orange-400 via-pink-500 to-rose-500',
  'from-emerald-400 via-teal-500 to-blue-500'
]

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

function pickBySeed(list, seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % list.length
  }
  return list[Math.abs(hash) % list.length]
}

/**
 * Maps a Firestore stories/{id} document into the shape StoryBubble.jsx
 * already expects (label, initials, colorClass, ringClass, username).
 * isAdd/isMore are never set here — those two bubbles are UI-only
 * affordances built locally in HomePage.jsx, not real story documents.
 */
function mapStoryDoc(docSnap) {
  const data = docSnap.data()
  const seed = data.userId || data.displayName || docSnap.id

  return {
    id: docSnap.id,
    label: data.displayName || 'Student',
    username: data.username || '',
    initials: getInitials(data.displayName),
    colorClass: pickBySeed(AVATAR_COLORS, seed),
    ringClass: pickBySeed(RING_COLORS, seed)
  }
}

/**
 * Loads public stories, newest first.
 *
 * NOTE: combines an equality filter (visibility) with orderBy on a
 * different field (createdAt) — same as postService.js, this requires a
 * Firestore composite index the first time it runs against a real
 * project; Firestore's error includes a direct link to create it.
 */
export async function getFeedStories(maxResults = 20) {
  const storiesQuery = query(
    collection(db, COLLECTION),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(maxResults)
  )
  const snap = await getDocs(storiesQuery)
  return snap.docs.map(mapStoryDoc)
}