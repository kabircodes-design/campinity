import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { getAvatarColor, getInitials } from './postService.js'

const COLLECTION = 'stories'

const RING_COLORS = [
  'from-pink-500 via-red-500 to-yellow-500',
  'from-blue-400 via-blue-500 to-indigo-500',
  'from-orange-400 via-pink-500 to-rose-500',
  'from-emerald-400 via-teal-500 to-blue-500'
]

function pickRingBySeed(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % RING_COLORS.length
  }
  return RING_COLORS[Math.abs(hash) % RING_COLORS.length]
}

/**
 * Maps a Firestore stories/{id} document into the shape StoryBubble.jsx
 * already expects (label, initials, colorClass, ringClass, username).
 * isAdd/isMore are never set here — those two bubbles are UI-only
 * affordances built locally in HomePage.jsx, not real story documents.
 *
 * initials/colorClass use the SAME functions every other surface uses
 * (postService.js) — this is what guarantees a story bubble shows
 * exactly the same avatar color as that person's posts, comments,
 * profile, chat, and everywhere else, rather than a coincidentally
 * matching separate implementation.
 */
function mapStoryDoc(docSnap) {
  const data = docSnap.data()
  const seed = data.userId || data.displayName || docSnap.id

  return {
    id: docSnap.id,
    label: data.displayName || 'Student',
    username: data.username || '',
    initials: getInitials(data.displayName),
    colorClass: getAvatarColor(seed),
    ringClass: pickRingBySeed(seed)
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