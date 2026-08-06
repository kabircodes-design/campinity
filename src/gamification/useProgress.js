import { useEffect, useState } from 'react'
import { subscribeToUserProgress } from './xpService.js'

/**
 * Real-time XP/level/points/streak/badges/rank for a given uid.
 * subscribeToUserProgress now does all the work (init-on-first-access,
 * level computation, badge count, rank) — this hook just consumes the
 * already-complete shape, not a partial one to enrich further.
 *
 * This is the actual connection point requirement #2 asked for:
 * calling useProgress(uid) is what triggers userProgress/{uid} to be
 * created in Firestore on first use, from any component that mounts
 * it — Profile and Home both do, via ProgressCard/ProgressWidget below.
 */
export function useProgress(uid) {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setProgress(null)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const unsubscribe = subscribeToUserProgress(uid, (data) => {
      setProgress(data)
      setLoading(false)
    })
    return unsubscribe
  }, [uid])

  return { progress, loading }
}
