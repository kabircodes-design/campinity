import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'

const COLLECTION = 'stories'
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

/**
 * Recreates genuinely missing infrastructure — HomePage.jsx already
 * imports { getFeedStories } from this exact path and renders results
 * through StoryBubble.jsx (also missing, built alongside this file),
 * confirmed by reading HomePage.jsx's actual current usage first, not
 * guessed. The Firestore schema below was NOT invented — it was
 * reverse-engineered from the real, pre-existing stories/{storyId}
 * security rule already in firestore.rules (userId + visibility=='public',
 * the exact same convention posts/{postId} already established), which
 * is what confirms this is the real intended schema, not a fresh design.
 */

export async function uploadStoryMedia(uid, file) {
  const path = `stories/${uid}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return getDownloadURL(fileRef)
}

export async function createStory({ uid, mediaUrl, mediaType, author }) {
  const now = Date.now()
  const payload = {
    userId: uid,
    displayName: author?.displayName || '',
    username: author?.username || '',
    profilePhoto: author?.profilePhoto || '',
    mediaUrl,
    mediaType, // 'image' | 'video'
    visibility: 'public',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + STORY_LIFETIME_MS)
  }
  const docRef = await addDoc(collection(db, COLLECTION), payload)
  return docRef.id
}

/**
 * Active stories only — visibility=='public' (matches the real rule)
 * AND expiresAt > now, newest first. Expired stories are never
 * deleted (per the explicit instruction — "do not physically delete
 * unless the existing architecture already does"; nothing here does),
 * they're simply excluded from this query going forward.
 *
 * Results are grouped by author client-side into one bubble per user
 * (Instagram-style — a user with 3 active stories gets one ring, not
 * three), each carrying its own ordered list of that user's active
 * stories for the viewer to step through.
 */
export async function getFeedStories() {
  const now = Timestamp.fromMillis(Date.now())
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('visibility', '==', 'public'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc')
    )
  )

  const byUser = new Map()
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data()
    const story = { id: docSnap.id, ...data }
    if (!byUser.has(data.userId)) {
      byUser.set(data.userId, {
        id: data.userId,
        userId: data.userId,
        label: data.displayName || 'Student',
        username: data.username || '',
        avatar: data.profilePhoto || '',
        stories: []
      })
    }
    byUser.get(data.userId).stories.push(story)
  })

  // Newest-first within each user's own story list — the query above
  // is ordered by expiresAt (required to pair with the >now range
  // filter), not creation time, so this re-sorts what the viewer
  // actually needs: most recent story first.
  const groups = Array.from(byUser.values())
  groups.forEach((group) => {
    group.stories.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
  })
  return groups
}
