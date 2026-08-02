import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from 'firebase/firestore'
import { db } from '../firebase/firebase.js'

const IN_QUERY_CHUNK_SIZE = 30 // Firestore's `in` operator max array size

/**
 * Real, server-side following feed — not a client-side filter over an
 * already-fetched batch of posts (which is what the "Following" tab
 * was actually doing before this: HomePage.jsx called getFeedPosts()
 * ONCE and filtered the result by `post.feedCategories.includes('following')`
 * client-side, which can't be "correct" in the way this task
 * describes, since it never queries by the follow graph at all — it
 * relies on whatever feedCategories a post happened to be tagged with
 * at write time).
 *
 * Two live listeners, layered:
 *  1. follows/{followerId}==uid — gives the current, live list of
 *     followed uids. Whenever THIS changes (follow/unfollow), the
 *     posts listeners below are torn down and rebuilt against the new
 *     list — this is what makes "unfollow -> posts disappear
 *     immediately" and "follow -> their existing posts appear
 *     immediately" both true, not just "new posts from someone I
 *     already followed show up."
 *  2. posts where userId in [chunk] && visibility=='public',
 *     ordered by createdAt desc — one listener per chunk of up to 30
 *     followed uids (Firestore's `in` operator hard limit). Multiple
 *     chunks' results are merged and re-sorted client-side ONLY across
 *     chunk boundaries — each individual chunk's results already
 *     arrive sorted from Firestore itself, so this isn't "fetch
 *     everything and filter/sort on the client," it's "combine N
 *     already-correctly-queried, already-sorted result sets."
 *
 * visibility=='public' is required IN the query (not just checked
 * after the fact) because this project's actual Firestore security
 * rule for posts/{postId} only allows reads where
 * resource.data.visibility == 'public' — a query missing that
 * constraint would be rejected by the rules engine outright, not
 * just return fewer results.
 *
 * Real, concrete requirement this creates: a composite index on
 * posts for (userId ARRAY/IN, visibility ASC, createdAt DESC). Without
 * it, this throws FAILED_PRECONDITION at runtime, same class of issue
 * already flagged in this project's last audit for other queries.
 */
export function useFollowingFeed(uid) {
  const [followingIds, setFollowingIds] = useState(null) // null = not loaded yet, [] = loaded, follows no one
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Listener 1 — the live follow list.
  useEffect(() => {
    if (!uid) {
      setFollowingIds([])
      return undefined
    }
    const followsQuery = query(collection(db, 'follows'), where('followerId', '==', uid))
    const unsubscribe = onSnapshot(
      followsQuery,
      (snap) => {
        setFollowingIds(snap.docs.map((d) => d.data().followingId))
      },
      (err) => {
        setError(err?.message || 'Could not load your following list.')
        setFollowingIds([])
      }
    )
    return () => unsubscribe()
  }, [uid])

  // Listener 2(+) — posts from the followed uids, rebuilt whenever
  // followingIds changes (a genuinely new follow/unfollow, not a
  // reference change — compared by value below to avoid tearing down
  // and rebuilding listeners on every unrelated re-render).
  useEffect(() => {
    if (followingIds === null) return undefined // still waiting on listener 1

    if (followingIds.length === 0) {
      setPosts([])
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError('')

    const chunks = []
    for (let i = 0; i < followingIds.length; i += IN_QUERY_CHUNK_SIZE) {
      chunks.push(followingIds.slice(i, i + IN_QUERY_CHUNK_SIZE))
    }

    // Each chunk keeps its own latest result set; merged and re-sorted
    // into `posts` state every time ANY chunk updates.
    const chunkResults = chunks.map(() => [])
    let receivedCount = 0

    const mergeAndSet = () => {
      const merged = chunkResults.flat()
      merged.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
        return bTime - aTime
      })
      setPosts(merged)
    }

    const unsubscribes = chunks.map((chunk, index) => {
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', chunk),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc')
      )
      return onSnapshot(
        postsQuery,
        (snap) => {
          chunkResults[index] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          receivedCount = Math.min(chunks.length, receivedCount + 1)
          mergeAndSet()
          if (receivedCount >= chunks.length) setLoading(false)
        },
        (err) => {
          setError(err?.message || 'Could not load posts from people you follow.')
          setLoading(false)
        }
      )
    })

    return () => {
      unsubscribes.forEach((unsub) => unsub())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compared by value below, not by reference, to avoid rebuilding listeners on every unrelated re-render
  }, [JSON.stringify(followingIds)])

  return { posts, loading, error, isFollowingAnyone: (followingIds?.length ?? 0) > 0 }
}
