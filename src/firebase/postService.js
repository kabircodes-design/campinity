import { addDoc, collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, storage } from './firebase.js'
import { normalizeHashtag } from '../utils/hashtags.js'

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
  // `= ''` only covers an omitted/undefined argument — an explicit
  // `null` (a real value seen in practice, e.g. a call target whose
  // profile hasn't loaded yet) skips the default and previously
  // crashed here on `.trim()`, taking down the whole render tree with
  // no error boundary to catch it. `?? ''` catches both.
  const safeName = name ?? ''
  const parts = safeName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

/** Deterministic so the same author always gets the same avatar color. */
export function getAvatarColor(seed = '') {
  const safeSeed = seed ?? ''
  let hash = 0
  for (let i = 0; i < safeSeed.length; i += 1) {
    hash = (hash * 31 + safeSeed.charCodeAt(i)) % AVATAR_COLORS.length
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
    userId: data.userId,
    type: 'general',
    category: data.category || 'general',
    name: data.displayName || 'Student',
    username: data.username || '',
    initials: getInitials(data.displayName),
    avatarColor: getAvatarColor(data.userId || data.displayName || docSnap.id),
    department: '',
    year: '',
    college: '',
    time: formatTimeAgo(data.createdAt),
    createdAtMs: data.createdAt?.toMillis ? data.createdAt.toMillis() : 0,
    expiresAtMs: data.expiresAt?.toMillis ? data.expiresAt.toMillis() : null,
    text: data.text || '',
    imagePreviewUrl: data.image || undefined,
    file: data.file || null,
    subject: data.subject || null,
    collection: data.collection || null,
    chapter: data.chapter || null,
    likes: data.likesCount || 0,
    comments: data.commentsCount || 0,
    likedByMe: currentUid ? likedBy.includes(currentUid) : false,
    poll: data.poll || null,
    collegeId: data.collegeId || null,
    // PRE-EXISTING BUG FOUND while adding campus-feed scoping: this was
    // hardcoded to ['forYou'] only, so HomePage.jsx's Campus tab filter
    // (post.feedCategories.includes('campus')) could never match a
    // single post — the Campus tab has always rendered empty, for every
    // user, regardless of real post volume. Fixed by including 'campus'
    // too, restoring what getFeedPosts' own broad "every public post"
    // query already implies. HomePage.jsx's own campus-priority sort
    // (added alongside this) then reorders THIS now-populated list by
    // collegeId match, rather than the tab having nothing to reorder.
    feedCategories: ['forYou', 'campus']
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
/**
 * Root-cause fix for "Profile shows 50 posts even after 80 were
 * created": getUserPosts caps at maxResults=50 (correctly — the grid
 * shouldn't download every post a user has ever made just to render a
 * page), and both profile pages were computing postsCount from
 * that SAME capped array's .length, conflating "posts loaded for
 * display" with "total posts that exist." This is the real total,
 * via Firestore's count() aggregation — one server-side count read
 * regardless of whether the user has 3 posts or 3,000, never
 * downloading the documents themselves. Same where() clauses as
 * getUserPosts (own public posts), so this counts exactly what that
 * grid would show if fully paginated — not a different definition of
 * "post."
 */
export async function getUserPostCount(userId) {
  const countQuery = query(collection(db, COLLECTION), where('userId', '==', userId), where('visibility', '==', 'public'))
  const snap = await getCountFromServer(countQuery)
  return snap.data().count
}

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
/**
 * Loads posts tagged with the existing 'notes' category, newest
 * first — used by Home's Notes tab. Reuses category='notes', which
 * was already a real, user-selectable option in the post composer
 * before this feature existed; no new field was invented. Same
 * index-avoidance reasoning as getUserPosts just above: two equality
 * filters (category, visibility) stay index-free, so sorting happens
 * client-side rather than via orderBy.
 */
export async function getNotesPosts(currentUid, maxResults = 100) {
  const postsQuery = query(
    collection(db, COLLECTION),
    where('category', '==', 'notes'),
    where('visibility', '==', 'public'),
    limit(maxResults)
  )
  const snap = await getDocs(postsQuery)
  const posts = snap.docs.map((docSnap) => mapPostDoc(docSnap, currentUid))
  const now = Date.now()
  return posts
    .filter((p) => !p.expiresAtMs || p.expiresAtMs > now)
    .sort((a, b) => {
    const aMs = a.createdAtMs || 0
    const bMs = b.createdAtMs || 0
    return bMs - aMs
  })
}

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
 * REBUILT for the verification-access-control PDF security fix — this
 * used to call getDownloadURL() and hand that back to be stored
 * directly on the post document, same as uploadPostImage. That is a
 * real, confirmed bypass: a Firebase Storage download URL carries its
 * own bearer token in the query string, so once it's sitting in a
 * posts/{postId} document (readable by any signed-in user), ANYONE can
 * open it forever — Storage rules only ever gated the act of calling
 * getDownloadURL() itself, never the token it hands back. Post PHOTOS
 * are deliberately NOT changed (they're meant to render inline in the
 * feed for any signed-in browser, not a protected "campus resource" —
 * only documents/PDFs are the access-controlled content type here).
 * This now returns only the Storage PATH; the post document stores
 * that path, never a usable URL. Resolving a path into an actual,
 * short-lived, verification-checked URL happens through
 * getVerifiedPostDocumentUrl (Cloud Function, Admin SDK), the same
 * signed-URL pattern adminGetVerificationDocumentUrl already
 * established for ID documents in functions/index.js — not a new
 * pattern invented for this.
 *
 * Deliberately a SEPARATE path prefix from uploadPostImage
 * (postDocuments/ vs postImages/), not the same folder — the Storage
 * rule for postImages/ allows any signed-in user to call
 * getDownloadURL() directly (that's correct for freely-viewable feed
 * photos), so a document sharing that prefix would let anyone who
 * reads the path off the Firestore post doc fetch it straight through
 * the client SDK, completely bypassing the Cloud Function above. A
 * distinct prefix lets storage.rules gate this one behind isVerified()
 * as real defense-in-depth, not just a fresh token each time.
 */
export async function uploadPostDocument(uid, file) {
  const path = `postDocuments/${uid}/${Date.now()}-${file.name}`
  const fileRef = ref(storage, path)
  await uploadBytes(fileRef, file)
  return path
}

/**
 * Resolves a posts/{postId} document into a real, short-lived signed
 * URL — server-verifies auth + verifiedCampus + that the document
 * actually belongs to that post before minting anything. The client
 * never supplies a Storage path directly (that would let anyone probe
 * arbitrary paths); it only ever supplies a postId it can already read.
 */
export async function getVerifiedPostDocumentUrl(postId) {
  const fn = httpsCallable(getFunctions(), 'getVerifiedPostDocumentUrl')
  const result = await fn({ postId })
  return result.data?.url
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
 * `textLower` — added for Phase 3 post search. Firestore has no
 * substring/full-text search; a lowercase prefix-indexed field is the
 * same established pattern already used for users (displayNameLower)
 * and communities. This is a PREFIX match only ("hello" matches a post
 * starting with "hello world", not one containing "say hello there") —
 * a real, stated limitation, not full-text search. Only written at
 * creation time here; existing posts created before this change won't
 * have it (handled gracefully in searchPostsByText below, not migrated).
 *
 * Returns the new document's id.
 */
/**
 * Post lifetime feature — additive only, no existing field renamed.
 * Duration math lives here once, reused by both the composer's real
 * publish-time computation and its live preview text, so they can
 * never drift apart.
 */
export const EXPIRATION_DURATIONS_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  never: null
}

export function computeExpiresAt(expirationType) {
  const durationMs = EXPIRATION_DURATIONS_MS[expirationType]
  if (!durationMs) return null
  return Timestamp.fromDate(new Date(Date.now() + durationMs))
}

export async function createPost({ uid, text, imageUrl, author, extra = {} }) {
  const payload = {
    userId: uid,
    displayName: author.displayName || '',
    username: author.username || '',
    profilePhoto: author.profilePhoto || '',
    text: text || '',
    textLower: (text || '').trim().toLowerCase(),
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

/**
 * Prefix search on post text — same query shape as searchCommunitiesByName
 * in communityService.js, but implemented as a real Firestore prefix-range
 * query (not client-side filtering) since textLower is written fresh at
 * creation time going forward, making a proper indexed range query
 * possible for any post created after this change.
 *
 * Posts created before textLower existed are invisible to this search —
 * a real, honest gap (see the note on createPost above), not silently
 * hidden. There is no safe way to backfill textLower onto every existing
 * post from client code (would require iterating the entire collection
 * and writing to documents this function has no legitimate reason to
 * touch otherwise), so this is stated as a limitation, not solved here.
 */
/**
 * Bounded, indexed query — array-contains on `hashtags` combined with
 * the `visibility` equality filter and an orderBy on createdAt needs a
 * Firestore COMPOSITE index (array-contains + equality + orderBy on a
 * third field isn't covered by Firestore's automatic single-field
 * indexes). Same one-time-setup situation getFeedPosts already
 * documents: Firestore's own error, the first time this runs for
 * real, includes a direct console link to create it — not something
 * this pass can do from application code. Normalization
 * (normalizeHashtag) matches exactly what CreatePostPage.jsx's
 * extractHashtags() already writes, so a search for "#CampusLife" or
 * "campuslife" or "#campuslife" all resolve to the same stored value.
 */
export async function searchPostsByHashtag(tag, currentUid, { resultLimit = 20 } = {}) {
  const normalized = normalizeHashtag(tag)
  if (!normalized) return []

  const postsQuery = query(
    collection(db, COLLECTION),
    where('visibility', '==', 'public'),
    where('hashtags', 'array-contains', normalized),
    orderBy('createdAt', 'desc'),
    limit(resultLimit)
  )
  const snap = await getDocs(postsQuery)
  return snap.docs.map((docSnap) => mapPostDoc(docSnap, currentUid))
}

export async function searchPostsByText(term, currentUid, { resultLimit = 20 } = {}) {
  const normalized = term.trim().toLowerCase()
  if (!normalized) return []

  const postsQuery = query(
    collection(db, COLLECTION),
    where('visibility', '==', 'public'),
    where('textLower', '>=', normalized),
    where('textLower', '<=', normalized + '\uf8ff'),
    limit(resultLimit)
  )
  const snap = await getDocs(postsQuery)
  return snap.docs.map((docSnap) => mapPostDoc(docSnap, currentUid))
}
