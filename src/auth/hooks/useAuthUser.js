import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebase.js'
import { HEARTBEAT_INTERVAL_MS, touchPresence } from '../../firebase/presenceService.js'
import { primeAuthorCache } from '../../hooks/useAuthorEnrichment.js'

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
          const data = snap.exists() ? snap.data() : null
          setProfile(data)
          setLoading(false)
          // Keeps useAuthorEnrichment.js's shared post/comment-author
          // cache honest for the CURRENT user specifically — see
          // primeAuthorCache's own comment for why this is the one uid
          // this listener can safely push live, without needing a
          // listener per author. Fixes "I changed my photo and my
          // profile/sidebar updated, but my own posts/comments still
          // show the old one until I hard-refresh."
          primeAuthorCache(firebaseUser.uid, data)
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

  // Presence heartbeat — see presenceService.js for the honest scope of
  // what this can and can't guarantee. Runs once at mount (so "Online"
  // is accurate immediately, not just after the first interval tick)
  // and every HEARTBEAT_INTERVAL_MS while a user is signed in and this
  // hook (i.e. any protected route) is mounted; only while the tab is
  // actually visible, so a backgrounded tab doesn't keep writing.
  useEffect(() => {
    if (!user?.uid) return undefined

    touchPresence(user.uid)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') touchPresence(user.uid)
    }, HEARTBEAT_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') touchPresence(user.uid)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.uid])

  return { user, profile, loading }
}