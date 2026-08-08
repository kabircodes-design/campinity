import { useEffect, useState } from 'react'
import { getUserProfile } from '../firebase/profileService.js'

/** Small, one-time profile fetch — used by RadarPage.jsx for the current user's own course/year/collegeId/interests, needed by both the presence hook and the filter row. */
export function useProfile(uid) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    getUserProfile(uid).then((data) => {
      if (!cancelled) {
        setProfile(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  return { profile, loading }
}
