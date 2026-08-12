import { getDocs, onSnapshot } from 'firebase/firestore'
import { getAvatarColor, getInitials, formatTimeAgo } from '../firebase/postService.js'
import { enrichWithAuthors } from './useAuthorEnrichment.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

/**
 * The ONE shared post-rendering pipeline — Following and For You both
 * go through this now. Per this task's explicit requirement: "the
 * only difference between them should be WHICH posts are fetched, not
 * how posts are rendered." Each hook builds its own Firestore query
 * (that's the "which posts" part, and stays hook-specific); both pass
 * that query into subscribeToEnrichedPostsQuery below (the "how
 * they're rendered" part, now written exactly once).
 *
 * This used to live only inside useFollowingFeed.js. Extracted here
 * when useForYouFeed.js needed the identical mapping/enrichment/
 * race-guard logic — the actual root cause of the "For You always
 * shows General" bug was that For You never went through this pipeline
 * at all (it rendered whatever postService.js's own getFeedPosts()
 * mapper produced, which has a category-mapping bug I can't fix
 * directly since I don't have that file). Routing For You through
 * this same pipeline instead sidesteps that bug entirely, and is also
 * exactly what "zero duplicated logic, both feeds render identically"
 * asks for.
 */

/**
 * Maps a raw posts/{postId} Firestore document into the shape
 * PostCard.jsx actually reads, using a LIVE-fetched profile
 * (liveProfile, from useAuthorEnrichment.js) instead of the `author`
 * object snapshotted onto the post at creation time — a stale
 * write-time snapshot can't reflect a later profile-photo or
 * display-name change; this always shows current data.
 *
 * type: raw.category is the actual fix for the category-badge bug —
 * this reads the real field a post was created with (confirmed from
 * CreatePostPage.jsx: extra: { category, ... }), not whatever
 * postService.js's separate mapper does with it.
 *
 * Anonymous posts are the one deliberate exception: liveProfile is
 * never applied when raw.isAnonymous is true — enriching an anonymous
 * post with the real poster's live identity would be a privacy bug.
 * Callers never even fetch a profile for an anonymous post's userId
 * in the first place (see each hook's getUid callback), so this is
 * belt-and-suspenders, not the only safeguard.
 */
export function mapPostForCard(raw, currentUid, liveProfile) {
  const useAnonymous = raw.isAnonymous
  const displayName = useAnonymous ? 'Anonymous' : liveProfile?.displayName || 'Student'
  const username = useAnonymous ? '' : liveProfile?.username || ''
  const avatarSeed = useAnonymous ? 'anonymous' : raw.userId

  return {
    id: raw.id,
    userId: raw.userId,
    type: raw.category || 'general',
    text: raw.text || '',
    imageUrl: raw.image || null,
    imagePreviewUrl: raw.image || null,
    name: displayName,
    username,
    verified: useAnonymous ? false : Boolean(liveProfile?.verifiedCampus),
    avatarUrl: useAnonymous ? '' : getProfileIdentityImage(liveProfile) || '',
    initials: getInitials(displayName),
    avatarColor: getAvatarColor(avatarSeed),
    department: undefined,
    year: undefined,
    college: undefined,
    time: formatTimeAgo(raw.createdAt),
    _createdAtMs: raw.createdAt?.toMillis ? raw.createdAt.toMillis() : 0,
    likes: raw.likesCount || 0,
    likedByMe: Array.isArray(raw.likedBy) && currentUid ? raw.likedBy.includes(currentUid) : false,
    comments: raw.commentsCount || 0,
    shareCount: raw.shareCount || 0,
    communityId: raw.communityId || null,
    communityName: raw.communityName || null,
    file: raw.file,
    event: raw.event,
    marketplace: raw.marketplace,
    lostFound: raw.lostFound
  }
}

/**
 * Subscribes to a caller-built Firestore query, enriches + maps every
 * snapshot, and delivers already-mapped, already-enriched, correctly
 * ordered posts to onUpdate. Includes the sequence-guard needed
 * because enrichment is async: if a newer snapshot arrives while an
 * older snapshot's enrichment is still in flight, the older result is
 * dropped rather than allowed to overwrite the newer one.
 *
 * onUpdate now also receives the raw last QueryDocumentSnapshot from
 * this batch — an additive second argument, not a breaking change.
 * useFollowingFeed.js's existing (enriched) => {...} callback still
 * works unmodified (it just never reads the second argument).
 * useForYouFeed.js uses it as the pagination cursor: Firestore's
 * startAfter() needs the actual document snapshot, not a value, and
 * this is the only place that snapshot exists before mapping discards
 * it.
 *
 * Returns the unsubscribe function — caller is responsible for
 * cleanup, same as calling onSnapshot directly would require.
 */
export function subscribeToEnrichedPostsQuery(postsQuery, currentUid, onUpdate, onError) {
  let sequence = 0

  return onSnapshot(
    postsQuery,
    (snap) => {
      const thisSequence = ++sequence
      const rawDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const lastRawDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null

      enrichWithAuthors(
        rawDocs,
        (raw) => (raw.isAnonymous ? null : raw.userId),
        (raw, profile) => mapPostForCard(raw, currentUid, profile)
      ).then((enriched) => {
        if (sequence !== thisSequence) return // a newer snapshot already arrived; drop this stale result
        onUpdate(enriched, lastRawDoc)
      })
    },
    (err) => {
      onError?.(err)
    }
  )
}

/**
 * One-time (not live) paginated fetch — the "load next page" half of
 * cursor pagination. Same enrichment pipeline as the live subscription
 * above (mapPostForCard, enrichWithAuthors), so a paginated post and a
 * live-subscribed post are visually and structurally identical, never
 * two different code paths a user could notice diverge.
 */
export async function fetchEnrichedPostsPage(postsQuery, currentUid) {
  const snap = await getDocs(postsQuery)
  const rawDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const lastRawDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null

  const enriched = await enrichWithAuthors(
    rawDocs,
    (raw) => (raw.isAnonymous ? null : raw.userId),
    (raw, profile) => mapPostForCard(raw, currentUid, profile)
  )

  return { posts: enriched, lastRawDoc, isLastPage: snap.docs.length === 0 }
}
