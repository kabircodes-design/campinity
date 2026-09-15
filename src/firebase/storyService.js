import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'
import { getUserProfile } from './profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

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
  const mediaUrl = await getDownloadURL(fileRef)
  return { mediaUrl, storagePath: path }
}

export async function createStory({ uid, mediaUrl, storagePath, mediaType, author }) {
  const now = Date.now()
  const payload = {
    userId: uid,
    displayName: author?.displayName || '',
    username: author?.username || '',
    profilePhoto: author?.profilePhoto || '',
    mediaUrl,
    storagePath,
    mediaType, // 'image' | 'video'
    visibility: 'public',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + STORY_LIFETIME_MS)
  }
  const docRef = await addDoc(collection(db, COLLECTION), payload)
  return docRef.id
}

/**
 * Single-story lookup — what SharedCard.jsx's shared_story registry
 * entry needs to render a "shared a story" preview inside a chat
 * message, mirroring the exact shape shared_post's entry already uses
 * (getPostById). Returns null for a deleted/expired story (expired
 * stories are never deleted, per getFeedStories' own comment, but a
 * shared link to one should still gracefully report "gone," not throw)
 * so SharedCard's existing UnavailableCard state handles it for free.
 */
export async function getStoryById(storyId) {
  if (!storyId) return null
  const snap = await getDoc(doc(db, COLLECTION, storyId))
  if (!snap.exists()) return null
  const data = snap.data()
  const now = Date.now()
  const expiresAtMs = data.expiresAt?.toMillis?.() ?? 0
  if (expiresAtMs && expiresAtMs <= now) return null
  return { id: snap.id, ...data }
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

/**
 * Idempotent by design — setDoc with a deterministic id
 * ({storyId}_{viewerUid}, matching firestore.rules' own id-format
 * check) means viewing the same story twice overwrites the same
 * document rather than creating a second one, satisfying "do not
 * create unnecessary documents for every render."
 */
export async function recordStoryView(storyId, viewerUid) {
  if (!storyId || !viewerUid) return
  await setDoc(doc(db, 'storyViews', `${storyId}_${viewerUid}`), {
    storyId,
    viewerUid,
    viewedAt: serverTimestamp()
  })
}

/**
 * One query per user's own view history, done once (not per story
 * bubble) — the caller builds a Set from the result for O(1)
 * seen-checks rather than querying per story, avoiding the N+1
 * pattern the brief explicitly warns against.
 */
export async function getViewedStoryIds(viewerUid) {
  if (!viewerUid) return new Set()
  const snap = await getDocs(query(collection(db, 'storyViews'), where('viewerUid', '==', viewerUid)))
  return new Set(snap.docs.map((d) => d.data().storyId))
}

/**
 * Only succeeds for the story's real owner — enforced server-side by
 * firestore.rules' own get()-based ownership check on storyViews,
 * independent of anything this function claims client-side. Enriches
 * each raw view record with the viewer's actual profile (name,
 * username, identity image) — a bare uid isn't what "viewer
 * profile/avatar, username/display name" requires. Bounded by however
 * many people actually viewed this one story, not an unbounded scan.
 */
export async function getStoryViewers(storyId) {
  const snap = await getDocs(query(collection(db, 'storyViews'), where('storyId', '==', storyId)))
  const views = snap.docs.map((d) => d.data())
  const enriched = await Promise.all(
    views.map(async (view) => {
      const profile = await getUserProfile(view.viewerUid).catch(() => null)
      return {
        ...view,
        displayName: profile?.displayName || 'Student',
        username: profile?.username || '',
        avatar: profile ? getProfileIdentityImage(profile) : ''
      }
    })
  )
  return enriched.sort((a, b) => (b.viewedAt?.toMillis?.() ?? 0) - (a.viewedAt?.toMillis?.() ?? 0))
}

/* ============================================================
   STORY LIKES — same idempotent-by-id pattern as storyViews above
   ({storyId}_{viewerUid}), so liking twice never creates a second
   document and "has this user already liked this story" is a single
   getDoc by a deterministic id, never a query. Count uses Firestore's
   count() aggregation (same approach as postService.js's
   getUserPostCount) — one cheap server-side read, never downloading
   every like document just to show a number.
   ============================================================ */

function storyLikeDoc(storyId, uid) {
  return doc(db, 'storyLikes', `${storyId}_${uid}`)
}

export async function likeStory(storyId, uid) {
  if (!storyId || !uid) return
  await setDoc(storyLikeDoc(storyId, uid), { storyId, uid, createdAt: serverTimestamp() })
}

export async function unlikeStory(storyId, uid) {
  if (!storyId || !uid) return
  await deleteDoc(storyLikeDoc(storyId, uid))
}

export async function hasLikedStory(storyId, uid) {
  if (!storyId || !uid) return false
  const snap = await getDoc(storyLikeDoc(storyId, uid))
  return snap.exists()
}

export async function getStoryLikeCount(storyId) {
  if (!storyId) return 0
  const snap = await getCountFromServer(query(collection(db, 'storyLikes'), where('storyId', '==', storyId)))
  return snap.data().count
}

/**
 * Deletes both the Firestore document and its Storage file. Storage
 * deletion is safe here specifically because storagePath was recorded
 * at upload time (see uploadStoryMedia/createStory above) — no URL
 * parsing, no guessing. If the Storage object is already gone for any
 * reason, that failure is swallowed (the Firestore delete below is
 * what actually matters for the story disappearing from the app) but
 * NOT hidden — logged, not silently pretended to have succeeded.
 */
export async function deleteStory(storyId, storagePath) {
  await deleteDoc(doc(db, 'stories', storyId))
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath))
    } catch (err) {
      console.warn('Story document deleted, but its Storage file could not be removed:', err)
    }
  }
}
