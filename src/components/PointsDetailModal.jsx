import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Gem, X } from 'lucide-react'
import { getRecentXPEntries } from '../gamification/xpService.js'
import { ACTIVITY_LABELS, POINTS_REWARDS } from '../gamification/config.js'
import { formatTimeAgo } from '../firebase/postService.js'

/**
 * Explains Campus Points as their own thing, not a second XP — the
 * config file already keeps POINTS_REWARDS deliberately distinct from
 * XP_REWARDS (only meaningful actions earn points; small/frequent ones
 * like a like given or a follow earn XP but no points), this modal just
 * surfaces that real distinction rather than inventing a new one.
 */
export default function PointsDetailModal({ open, onClose, uid, campusPoints }) {
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    if (!open || !uid) return
    let cancelled = false
    getRecentXPEntries(uid, 30)
      .then((all) => {
        if (!cancelled) setEntries(all.filter((e) => e.pointsAwarded > 0).slice(0, 8))
      })
      .catch(() => {
        if (!cancelled) setEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [open, uid])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 [animation:fadeIn_200ms_ease-out]" />
      <div className="relative w-full sm:max-w-[380px] max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 pb-8 sm:pb-5 shadow-xl [animation:modalIn_250ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-900">Campus Points</p>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center">
            <Gem className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{campusPoints}</p>
            <p className="text-xs text-gray-400">Campus Points</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500 leading-relaxed">
          Points are separate from XP — they're a reward for your most meaningful contributions (posts, notes,
          comments, shares, and content others found worth saving), not for every small action.
        </p>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ways to earn points</p>
        <div className="mt-2 space-y-1.5">
          {Object.entries(POINTS_REWARDS).map(([type, amount]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{ACTIVITY_LABELS[type] || type}</span>
              <span className="font-semibold text-cyan-600">+{amount}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Recent points</p>
        <div className="mt-2 space-y-2">
          {entries === null ? (
            <div className="h-10 animate-pulse bg-gray-100 rounded-xl" />
          ) : entries.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No points earned yet — start contributing to Campinity.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{ACTIVITY_LABELS[e.activityType] || e.activityType}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{formatTimeAgo(e.createdAt)}</span>
                  <span className="font-semibold text-cyan-600">+{e.pointsAwarded}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
