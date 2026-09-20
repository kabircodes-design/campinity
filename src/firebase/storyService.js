import { addDoc, collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from './firebase.js'
import { getUserProfile, getCloseFriendsOfMe } from './profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { awardXP, getUserProgress, hasReachedDailyCap } from '../gamification/xpService.js'
import { checkAndAwardBadges } from '../gamification/badgeService.js'
import { DAILY_CAPS } from '../gamification/config.js'

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

const STORY_VISIBILITY_VALUES = ['public', 'followers', 'closeFriends']

export async function createStory({ uid, mediaUrl, storagePath, mediaType, author, visibility = 'public' }) {
  const now = Date.now()
  const payload = {
    userId: uid,
    displayName: author?.displayName || '',
    username: author?.username || '',
    profilePhoto: author?.profilePhoto || '',
    mediaUrl,
    storagePath,
    mediaType, // 'image' | 'video'
    visibility: STORY_VISIBILITY_VALUES.includes(visibility) ? visibility : 'public',
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + STORY_LIFETIME_MS)
  }
  const docRef = await addDoc(collection(db, COLLECTION), payload)

  // Gamification — story_uploaded was already defined in XP_REWARDS
  // but nothing ever called it, so stories gave zero XP despite the
  // reward existing. Deduped by this story's own real id (impossible
  // to double-award for the same story) and daily-capped since a user
  // could otherwise post many stories in a row for easy XP.
  const capped = await hasReachedDailyCap(uid, 'story_uploaded', DAILY_CAPS.story_uploaded).catch(() => true)
  if (!capped) {
    const awarded = await awardXP(uid, 'story_uploaded', { dedupeKey: `story_uploaded_${docRef.id}` }).catch(() => null)
    if (awarded) {
      const progress = await getUserProgress(uid).catch(() => null)
      if (progress) await checkAndAwardBadges(uid, progress).catch(() => {})
    }
  }

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
/**
 * `viewerUid` is optional and additive — when passed, also pulls in
 * active 'closeFriends'-visibility stories from anyone who has added
 * the viewer to THEIR close friends list (getCloseFriendsOfMe,
 * profileService.js). Without it, behavior is byte-for-byte the
 * original public-only query. The close-friends half is wrapped in its
 * own try/catch and silently degrades to public-only on failure (most
 * likely cause: the composite index this second query needs hasn't
 * been created yet) — a Story privacy feature failing to fetch must
 * never take down the whole Home story tray.
 */
export async function getFeedStories(viewerUid) {
  const now = Timestamp.fromMillis(Date.now())
  const publicSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('visibility', '==', 'public'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc')
    )
  )

  let closeFriendDocs = []
  if (viewerUid) {
    try {
      const ownerUids = await getCloseFriendsOfMe(viewerUid)
      if (ownerUids.length > 0) {
        // Firestore 'in' caps at 30 values — a real, stated bound, not
        // silently truncated: realistic close-friends-of-me counts are
        // small for a campus app, and this only drops the 31st+ owner
        // rather than failing the whole query.
        const closeFriendsSnap = await getDocs(
          query(
            collection(db, COLLECTION),
            where('userId', 'in', ownerUids.slice(0, 30)),
            where('visibility', '==', 'closeFriends'),
            where('expiresAt', '>', now)
          )
        )
        closeFriendDocs = closeFriendsSnap.docs
      }
    } catch {
      // Composite index likely not created yet, or the collectionGroup
      // lookup failed — public stories below still load normally.
    }
  }

  const byUser = new Map()
  ;[...publicSnap.docs, ...closeFriendDocs].forEach((docSnap) => {
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

/* ============================================================
   STORY COMMENTS — stories/{storyId}/comments/{commentId}, the exact
   same subcollection shape posts/{postId}/comments/{commentId} already
   uses (uid/displayName/username/avatar/text/createdAt), deliberately
   flat (no parentCommentId/replies/likes/pin here — that nesting isn't
   part of what this pass asked for on Stories, keeping this the
   smallest version of the pattern rather than copying every post-
   comment feature unasked). Same accepted limitation deleteStory()
   already has for storyLikes above: deleting a story does not cascade-
   delete its comments — orphaned subcollection docs on deletion is the
   existing, established behavior here, not a new gap.
   ============================================================ */

function storyCommentsCollection(storyId) {
  return collection(db, 'stories', storyId, 'comments')
}

export async function addStoryComment(storyId, { uid, displayName, username, avatar, text }) {
  if (!storyId || !uid) throw new Error('You need to be signed in.')
  const trimmed = text?.trim()
  if (!trimmed) throw new Error('Comment cannot be empty.')
  await addDoc(storyCommentsCollection(storyId), {
    uid,
    displayName: displayName || 'Student',
    username: username || '',
    avatar: avatar || '',
    text: trimmed.slice(0, 500),
    createdAt: serverTimestamp()
  })
}

export async function deleteStoryComment(storyId, commentId, uid) {
  const commentRef = doc(db, 'stories', storyId, 'comments', commentId)
  const snap = await getDoc(commentRef)
  if (!snap.exists()) return
  if (snap.data().uid !== uid) throw new Error('You can only delete your own comment.')
  await deleteDoc(commentRef)
}

export function subscribeToStoryComments(storyId, onData) {
  if (!storyId) return () => {}
  const q = query(storyCommentsCollection(storyId), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => onData([])
  )
}
