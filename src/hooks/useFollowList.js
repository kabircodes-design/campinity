import { useEffect, useRef, useState } from 'react'
import { getFollowListPage } from '../firebase/profileService.js'
import { auth } from '../firebase/firebase.js'

/**
 * Real implementation — was referenced by FollowersPage.jsx/
 * FollowingPage.jsx (both pasted into this conversation) but never
 * shown to me. Return shape ({ users, loading, error }) and call
 * signature (targetUid, 'followers'|'following') match exactly what
 * those two pages already call, so neither page needs to change for
 * basic functionality to work — search and infinite scroll are added
 * on top via the extra returned fields below (searchTerm/setSearchTerm/
 * loadMore/hasMore), which those pages need a small update to actually
 * use (added separately).
 */
export function useFollowList(targetUid, direction) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const searchDebounceRef = useRef(null)

  useEffect(() => {
    if (!targetUid) {
      setUsers([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setCursor(null)

    window.clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = window.setTimeout(
      async () => {
        try {
          const { users: data, nextCursor } = await getFollowListPage(targetUid, direction, {
            searchTerm,
            viewerUid: auth.currentUser?.uid
          })
          if (cancelled) return
          setUsers(data)
          setCursor(nextCursor)
          setHasMore(Boolean(nextCursor))
        } catch (err) {
          if (!cancelled) setError(err?.message || 'Could not load this list.')
        } finally {
          if (!cancelled) setLoading(false)
        }
      },
      searchTerm ? 250 : 0
    )

    return () => {
      cancelled = true
      window.clearTimeout(searchDebounceRef.current)
    }
  }, [targetUid, direction, searchTerm])

  const loadMore = async () => {
    if (!targetUid || !cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const { users: data, nextCursor } = await getFollowListPage(targetUid, direction, {
        cursor,
        searchTerm,
        viewerUid: auth.currentUser?.uid
      })
      setUsers((prev) => [...prev, ...data])
      setCursor(nextCursor)
      setHasMore(Boolean(nextCursor))
    } catch {
      // Silently stop paginating on failure — the list already loaded
      // stays visible and usable rather than showing an error over
      // otherwise-good content.
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  return { users, loading, error, searchTerm, setSearchTerm, loadMore, hasMore, loadingMore }
}
