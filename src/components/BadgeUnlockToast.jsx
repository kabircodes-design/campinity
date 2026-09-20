import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { BADGES } from '../gamification/config.js'

const SEEN_GRACE_MS = 2 * 60 * 1000 // 2 minutes

/**
 * One-time achievement toast for a newly-unlocked badge — reuses the
 * `seen` field badgeService.awardBadge() already writes on every
 * userBadges/{uid}/earned doc (previously written but never read by
 * anything). On first mount for a user, anything already earned more
 * than SEEN_GRACE_MS ago is marked seen WITHOUT toasting (so a user who
 * already had badges before this shipped doesn't get a burst of old
 * "unlocked" toasts) — only genuinely new unlocks toast.
 *
 * Shows the badge's own real description as the "why" (never an
 * invented number — badges in this system don't carry a fixed bonus
 * XP value beyond whatever action already triggered the check, so no
 * "+X XP" line is fabricated here), with explicit "View Achievement" /
 * "Continue" actions rather than one opaque full-card tap target —
 * subtle, fast, and does not block the rest of the app underneath it.
 */
export default function BadgeUnlockToast({ uid }) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!uid) return undefined
    initializedRef.current = false

    const unsubscribe = onSnapshot(collection(db, 'userBadges', uid, 'earned'), (snap) => {
      const isFirstLoad = !initializedRef.current
      initializedRef.current = true

      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return
        const data = change.doc.data()
        if (data.seen) return

        const earnedAtMs = data.earnedAt?.toMillis ? data.earnedAt.toMillis() : Date.now()
        const isStale = isFirstLoad && Date.now() - earnedAtMs > SEEN_GRACE_MS

        if (isStale) {
          updateDoc(change.doc.ref, { seen: true }).catch(() => {})
          return
        }

        const badge = BADGES[data.badgeId]
        if (!badge) return
        setQueue((q) => [...q, { id: change.doc.id, ref: change.doc.ref, badge }])
      })
    })

    return unsubscribe
  }, [uid])

  if (queue.length === 0) return null
  const current = queue[0]

  const dismiss = () => {
    updateDoc(current.ref, { seen: true }).catch(() => {})
    setQueue((q) => q.slice(1))
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] w-full max-w-[340px] px-4">
      <div className="rounded-2xl bg-gray-900 text-white p-4 shadow-xl shadow-black/20 [animation:modalIn_250ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center gap-3">
          <span className="relative flex-shrink-0 w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-2xl">
            <span className="absolute inset-0 rounded-xl bg-amber-400/20 blur-md" aria-hidden="true" />
            <span className="relative">{current.badge.emoji}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">Achievement Unlocked</p>
            <p className="text-sm font-bold truncate">{current.badge.label}</p>
          </div>
        </div>
        {current.badge.description && (
          <p className="mt-2 text-xs text-white/60 leading-relaxed">{current.badge.description}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-full border border-white/15 text-white/80 text-xs font-semibold py-2 hover:bg-white/5 transition-colors"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              dismiss()
              navigate('/badges')
            }}
            className="flex-1 rounded-full bg-white text-gray-900 text-xs font-semibold py-2 hover:bg-gray-100 transition-colors"
          >
            View Achievement
          </button>
        </div>
      </div>
    </div>
  )
}
