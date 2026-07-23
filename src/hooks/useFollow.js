import { useEffect, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { followUser, isFollowing as checkIsFollowing, unfollowUser } from '../firebase/followService.js'

export function useFollow(targetUid) {
  const [following, setFollowing] = useState(false)
  const [initialFollowing, setInitialFollowing] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    if (!uid || !targetUid || uid === targetUid) {
      setChecking(false)
      return undefined
    }

    setChecking(true)
    checkIsFollowing(uid, targetUid)
      .then((result) => {
        if (!cancelled) {
          setFollowing(result)
          setInitialFollowing(result)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [targetUid])

  const toggleFollow = async () => {
    const uid = auth.currentUser?.uid
    if (!uid || !targetUid || uid === targetUid || isToggling || checking) return

    const nextFollowing = !following
    setFollowing(nextFollowing)
    setIsToggling(true)

    try {
      if (nextFollowing) {
        await followUser(uid, targetUid)
      } else {
        await unfollowUser(uid, targetUid)
      }
    } catch {
      setFollowing(!nextFollowing)
    } finally {
      setIsToggling(false)
    }
  }

  const followersDelta = (following ? 1 : 0) - (initialFollowing ? 1 : 0)

  return { following, checking, isToggling, toggleFollow, followersDelta }
}