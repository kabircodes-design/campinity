import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { BADGE_CATEGORY_LABELS } from '../gamification/config.js'
import { formatTimeAgo } from '../firebase/postService.js'

/**
 * One shared detail view for any badge — earned or locked — reused by
 * BadgesPage so the "why did I earn this" / "what do I still need"
 * story is told the exact same way everywhere a badge appears.
 */
export default function BadgeDetailModal({ open, onClose, badge, earnedAt, progress }) {
  if (!open || !badge) return null

  const isEarned = Boolean(earnedAt)
  const isManual = badge.criteria?.type === 'manual'

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 [animation:fadeIn_200ms_ease-out]" />
      <div className="relative w-full sm:max-w-[380px] rounded-t-2xl sm:rounded-2xl bg-white p-5 pb-8 sm:pb-5 shadow-xl text-center [animation:modalIn_250ms_cubic-bezier(0.16,1,0.3,1)]">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>

        <div
          className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
            isEarned ? 'bg-amber-50' : 'bg-gray-100 grayscale opacity-70'
          }`}
        >
          {badge.emoji}
        </div>

        <p className="mt-3 text-lg font-bold text-gray-900">{badge.label}</p>
        <span
          className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            isEarned ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {isEarned ? 'Unlocked' : 'Locked'}
        </span>
        {badge.category && (
          <p className="mt-1.5 text-[11px] text-gray-400">{BADGE_CATEGORY_LABELS[badge.category] || badge.category}</p>
        )}

        <p className="mt-3 text-sm text-gray-600 leading-relaxed">{badge.description}</p>

        {isEarned ? (
          <p className="mt-3 text-xs text-gray-400">Earned {formatTimeAgo(earnedAt)}</p>
        ) : isManual ? (
          <p className="mt-3 text-xs text-gray-400">Awarded by the Campinity team — not yet available to earn automatically.</p>
        ) : progress ? (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((progress.current / progress.target) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-500">
              Progress: {Math.min(progress.current, progress.target)} / {progress.target}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400">Progress isn't tracked for this badge yet.</p>
        )}
      </div>
    </div>,
    document.body
  )
}
