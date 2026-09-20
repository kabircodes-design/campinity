import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { BadgeCheck } from 'lucide-react'
import { db } from '../firebase/firebase.js'
import { markAchievementSeen } from '../firebase/achievementService.js'

const SEEN_GRACE_MS = 2 * 60 * 1000

/**
 * "New Verified Achievement" reveal — same idempotent seen-flag pattern
 * as BadgeUnlockToast.jsx (a verifiedAchievements doc is written with
 * seen:false by the admin-approval Cloud Function; this marks it seen
 * once shown so it never reappears on a later page load), kept as a
 * separate component rather than merging with BadgeUnlockToast since
 * the two watch different collections with different visual treatment
 * (per the brief's "clear distinction" requirement).
 */
export default function VerifiedAchievementUnlockToast({ uid }) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!uid) return undefined
    initializedRef.current = false

    const unsubscribe = onSnapshot(collection(db, 'users', uid, 'verifiedAchievements'), (snap) => {
      const isFirstLoad = !initializedRef.current
      initializedRef.current = true

      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return
        const data = change.doc.data()
        if (data.seen) return

        const earnedAtMs = data.earnedAt?.toMillis ? data.earnedAt.toMillis() : Date.now()
        const isStale = isFirstLoad && Date.now() - earnedAtMs > SEEN_GRACE_MS

        if (isStale) {
          markAchievementSeen(uid, change.doc.id)
          return
        }

        setQueue((q) => [...q, { id: change.doc.id, title: data.title }])
      })
    })

    return unsubscribe
  }, [uid])

  if (queue.length === 0) return null
  const current = queue[0]

  const dismiss = () => {
    markAchievementSeen(uid, current.id)
    setQueue((q) => q.slice(1))
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9997] w-full max-w-[360px] px-4">
      <button
        type="button"
        onClick={() => {
          dismiss()
          navigate('/badges')
        }}
        className="w-full flex items-center gap-3 rounded-2xl bg-blue-600 text-white px-4 py-3 shadow-xl text-left [animation:modalIn_250ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <BadgeCheck className="w-6 h-6 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-white/70 uppercase tracking-wide">New Verified Achievement</p>
          <p className="text-sm font-bold truncate">{current.title}</p>
        </div>
      </button>
    </div>
  )
}
