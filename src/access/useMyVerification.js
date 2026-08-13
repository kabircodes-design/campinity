import { useEffect, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'

// Module-level cache: many PostCard instances on one feed page would
// otherwise each independently fetch the SAME current-user profile
// just to read one boolean. One in-flight promise is shared across
// every simultaneous caller instead. Cleared on auth change so a
// logout/login (or verification completing) doesn't serve stale data.
let cachedPromise = null
let cachedForUid = null

export function useMyVerification() {
  const [verified, setVerified] = useState(null) // null = still loading

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setVerified(false)
      return
    }
    if (cachedForUid !== uid) {
      cachedForUid = uid
      cachedPromise = getUserProfile(uid).catch(() => null)
    }
    let cancelled = false
    cachedPromise.then((profile) => {
      if (!cancelled) setVerified(Boolean(profile?.verifiedCampus))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return verified
}

/** Called after a successful verification so already-mounted PostCards pick up the new status without a full page reload. */
export function invalidateVerificationCache() {
  cachedPromise = null
  cachedForUid = null
}
