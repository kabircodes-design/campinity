import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebase.js'

/**
 * Provides { user, profile, loading } for the currently signed-in user.
 *
 * profile is kept live via a Firestore onSnapshot() listener on
 * users/{uid} — NOT a one-time getDoc(). This is deliberate: onboarding
 * is a sequence of Firestore writes (Campus Verification's Skip, then
 * later Create Profile's save) with no Firebase Auth state change
 * between them. A one-time read tied to onAuthStateChanged only ever
 * sees whatever had landed in Firestore at the exact moment a given
 * ProtectedRoute/useAuthUser instance happened to mount — any instance
 * still alive from before a later write has no way to learn about it.
 * onSnapshot removes that dependency entirely: every mounted consumer
 * receives every write to its own profile document in real time,
 * regardless of mount timing, auth events, or how many onboarding steps
 * have run in the same SPA session.
 */
export function useAuthUser() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribeProfile = null

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)

      // Tear down any listener bound to the previous user's document
      // before attaching a new one (or none, on sign-out).
      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
      }

      if (!firebaseUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      unsubscribeProfile = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          setProfile(snap.exists() ? snap.data() : null)
          setLoading(false)
        },
        () => {
          setProfile(null)
          setLoading(false)
        }
      )
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeProfile) unsubscribeProfile()
    }
  }, [])

  return { user, profile, loading }
}