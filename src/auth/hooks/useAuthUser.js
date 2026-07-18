import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../../firebase/firebase.js'
import { getUserProfile } from '../utils/userProfile.js'

/**
 * Subscribes to Firebase auth state and mirrors the matching Firestore
 * profile doc. Used by ProtectedRoute/PublicRoute — each route mount gets
 * a fresh subscription, so a freshly-mounted guard always re-reads the
 * current profile instead of trusting stale state from a previous route.
 */
export function useAuthUser() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        try {
          const doc = await getUserProfile(firebaseUser.uid)
          setProfile(doc)
        } catch {
          setProfile(null)
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  return { user, profile, loading }
}