import { useEffect, useState } from 'react'
import { collection, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { subscribeToEnrichedPostsQuery } from './postFeedShared.js'

const PAGE_SIZE = 50

/**
 * For You feed — direct Firestore query + the same shared
 * enrichment/mapping pipeline useFollowingFeed.js uses
 * (postFeedShared.js), instead of routing through postService.js's
 * getFeedPosts(). That's a deliberate scope decision, not an
 * accident: the reported bug ("category always shows General") lives
 * inside getFeedPosts()'s own mapping, in a file I don't have access
 * to. Bypassing it for this tab, using the exact same pipeline
 * Following already proved correct, fixes the bug without needing to
 * guess at or patch code I can't see — and satisfies this task's own
 * "zero duplicated logic, both feeds render identically" requirement
 * more directly than trying to patch two different mappers to agree.
 *
 * Query is intentionally simple: all public posts, newest first,
 * capped at PAGE_SIZE. I don't know if "For You" in this project
 * means something more personalized than that (e.g. campus-scoped,
 * ranked) — postService.js might already do more here. If it does,
 * this is a narrower feed than before, not a wrong one; flagged
 * plainly rather than silently assumed to be a complete replacement of
 * whatever personalization may have existed.
 *
 * Same composite-index requirement as posts queries elsewhere in this
 * project: (visibility ASC, createdAt DESC).
 */
export function useForYouFeed(uid) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    const postsQuery = query(
      collection(db, 'posts'),
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    )

    const unsubscribe = subscribeToEnrichedPostsQuery(
      postsQuery,
      uid,
      (enriched) => {
        setPosts(enriched)
        setLoading(false)
      },
      (err) => {
        setError(err?.message || 'Could not load the feed.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [uid])

  return { posts, loading, error }
}
