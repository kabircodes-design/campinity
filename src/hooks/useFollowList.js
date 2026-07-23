import { useEffect, useRef, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { subscribeToFollowerIds, subscribeToFollowingIds } from '../firebase/followService.js'
import { getUserProfile } from '../firebase/profileService.js'

/**
 * Loads and keeps live a list of resolved user profiles for either the
 * followers or following relationship of `targetUid` (falls back to the
 * signed-in user if not provided — e.g. someone opening /followers
 * directly by URL rather than tapping through from a profile).
 * `direction` is 'followers' or 'following'.
 *
 * The underlying id list is realtime (onSnapshot); each id is then
 * resolved to a full profile via getUserProfile and cached for the
 * lifetime of this hook instance, so re-renders and list updates never
 * re-fetch a profile that's already been resolved once.
 */
export function useFollowList(targetUid, direction) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const profileCacheRef = useRef(new Map())

  useEffect(() => {
    const uid = targetUid || auth.currentUser?.uid
    if (!uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError('')

    const subscribe = direction === 'following' ? subscribeToFollowingIds : subscribeToFollowerIds

    const unsubscribe = subscribe(
      uid,
      async (ids) => {
        try {
          const profiles = await Promise.all(
            ids.map(async (otherUid) => {
              if (profileCacheRef.current.has(otherUid)) {
                return profileCacheRef.current.get(otherUid)
              }
              const profile = await getUserProfile(otherUid).catch(() => null)
              const entry = profile ? { uid: otherUid, ...profile } : null
              if (entry) profileCacheRef.current.set(otherUid, entry)
              return entry
            })
          )
          setUsers(profiles.filter(Boolean))
          setLoading(false)
        } catch {
          setError('Could not load this list.')
          setLoading(false)
        }
      },
      () => {
        setError('Could not load this list.')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [targetUid, direction])

  return { users, loading, error }
}