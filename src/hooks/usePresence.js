import { useEffect, useState } from 'react'
import { formatPresence, subscribeToPresence } from '../firebase/presenceService.js'
import { useAuth } from '../context/AuthContext.jsx'

const TICK_MS = 30 * 1000
const HIDDEN = { online: false, label: null }

/**
 * Live presence for one user: subscribes to their presence and
 * re-evaluates every 30s, so "Active now" ages to "Active recently" on
 * its own even when no new data arrives (the app closed). Shows nothing
 * when the other person hides their activity status — or, reciprocally,
 * when the viewer hides their own. Pass `enabled: false` (e.g. group
 * chats) to skip the listener entirely.
 */
export function usePresence(uid, { enabled = true } = {}) {
  const { profile: myProfile } = useAuth()
  const viewerHidden = myProfile?.activityStatusVisible === false
  const active = enabled && Boolean(uid) && !viewerHidden

  const [presence, setPresence] = useState({ lastActiveMs: null, visible: true })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) {
      setPresence({ lastActiveMs: null, visible: true })
      return undefined
    }
    return subscribeToPresence(uid, setPresence)
  }, [uid, active])

  useEffect(() => {
    if (!active) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [uid, active])

  if (!active || !presence.visible) return HIDDEN
  return formatPresence(presence.lastActiveMs, now)
}
