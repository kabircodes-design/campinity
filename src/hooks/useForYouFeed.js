import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, limit, orderBy, query, startAfter, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { subscribeToEnrichedPostsQuery, fetchEnrichedPostsPage } from './postFeedShared.js'

const PAGE_SIZE = 50

/**
 * Root cause of the 50-post ceiling, confirmed by reading this file's
 * prior version directly: a single limit(50) live onSnapshot with no
 * pagination mechanism at all — not a bug in a filter or a query
 * condition, just no "next page" ever existed.
 *
 * Architecture: live subscription for the newest page (so new posts
 * appear without a refresh, per "handle realtime/new posts
 * correctly"), one-time cursor-paginated fetches for everything older
 * (fetchEnrichedPostsPage, added to postFeedShared.js this pass) —
 * exactly the split this task's own brief suggested as a good
 * approach. The two are merged by id on every update, so a post that
 * exists in both the live window and an already-loaded page is never
 * duplicated, and a brand-new post arriving via the live subscription
 * is prepended without disturbing already-loaded older pages.
 *
 * Cursor correctness: Firestore's startAfter() takes an actual
 * QueryDocumentSnapshot, not a value — it anchors to that document's
 * real field values regardless of what's currently in any live
 * window, so it stays valid even as the live portion's top-50 shifts
 * from new posts arriving. The cursor is updated to the last document
 * of whichever fetch (live or paginated) most recently extended the
 * loaded range.
 *
 * Same composite-index requirement as before: (visibility ASC,
 * createdAt DESC) — unchanged, no new index needed for pagination
 * itself since startAfter uses the same query shape.
 */
export function useForYouFeed(uid, preferredCategories = []) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const cursorRef = useRef(null)
  const postsMapRef = useRef(new Map()) // id -> post, the source of truth merged into `posts` on every change

  const mergeAndSet = useCallback((newPosts) => {
    newPosts.forEach((post) => postsMapRef.current.set(post.id, post))
    const merged = Array.from(postsMapRef.current.values()).sort((a, b) => b._createdAtMs - a._createdAtMs)
    setPosts(merged)
    return merged
  }, [])

  // Simple, deterministic preference boost — NOT a hidden filter, and
  // deliberately decoupled from mergeAndSet/the subscription effect
  // above, so a preference change can never trigger an unnecessary
  // Firestore re-subscribe or reset accumulated pagination progress.
  // A post matching one of the user's chosen content-preference
  // categories (real values: general/study/notes/event/club/
  // marketplace — the field is called .type on the enriched post
  // object, confirmed against postFeedShared.js's own mapping, not
  // .category) is treated as if it were 6 hours newer for sorting
  // purposes only. This never removes a post from the feed and never
  // reorders across a large time gap — an old preferred post still
  // sinks below a much newer unpreferred one. No AI, no opaque score.
  const PREFERENCE_BOOST_MS = 6 * 60 * 60 * 1000
  const rankedPosts = useMemo(() => {
    if (preferredCategories.length === 0) return posts
    const score = (post) => (post._createdAtMs || 0) + (preferredCategories.includes(post.type) ? PREFERENCE_BOOST_MS : 0)
    return [...posts].sort((a, b) => score(b) - score(a))
  }, [posts, preferredCategories])

  useEffect(() => {
    setLoading(true)
    setError('')
    setHasMore(true)
    postsMapRef.current = new Map()
    cursorRef.current = null

    const postsQuery = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    )

    const unsubscribe = subscribeToEnrichedPostsQuery(
      postsQuery,
      uid,
      (enriched, lastRawDoc) => {
        const merged = mergeAndSet(enriched)
        // Only advance the cursor from the live window if no page has
        // been loaded beyond it yet — once the user has paginated
        // further, the live window's own last doc is no longer the
        // right "next page" starting point.
        if (!cursorRef.current) cursorRef.current = lastRawDoc
        setLoading(false)
        // TEMPORARY — remove once pagination is confirmed working in
        // the running app.
        console.log('[ForYou] initial/live page:', enriched.length, 'accumulated:', merged.length, 'cursor set:', Boolean(cursorRef.current))
      },
      (err) => {
        setError(err?.message || 'Could not load the feed.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [uid, mergeAndSet])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursorRef.current) {
      // TEMPORARY — remove once confirmed. Logs exactly why a
      // pagination attempt was skipped, if it was.
      console.log('[ForYou] loadMore skipped:', { loadingMore, hasMore, hasCursor: Boolean(cursorRef.current) })
      return
    }
    console.log('[ForYou] loadMore started') // TEMPORARY — remove once confirmed
    setLoadingMore(true)
    try {
      const pageQuery = query(
        collection(db, 'posts'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        startAfter(cursorRef.current),
        limit(PAGE_SIZE)
      )
      const { posts: page, lastRawDoc, isLastPage } = await fetchEnrichedPostsPage(pageQuery, uid)
      const merged = mergeAndSet(page)
      if (lastRawDoc) cursorRef.current = lastRawDoc
      const exhausted = isLastPage || page.length < PAGE_SIZE
      if (exhausted) setHasMore(false)
      // TEMPORARY — remove once confirmed.
      console.log('[ForYou] loadMore completed:', { newPageCount: page.length, mergedTotal: merged.length, hasMore: !exhausted })
    } catch (err) {
      setError(err?.message || 'Could not load more posts.')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, uid, mergeAndSet])

  return { posts: rankedPosts, loading, error, loadMore, loadingMore, hasMore }
}
