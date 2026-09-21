import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useProgress } from './useProgress.js'
import { countEventsOfType, getEarnedBadges, getBadgeProgress } from './badgeService.js'
import { BADGES } from './config.js'

/**
 * "Your Campus Impact" — literal, real counts only (no invented
 * interpretive claims like an unverifiable "helped 3 students"). Each
 * number is a direct countEventsOfType query against the same xpLog
 * this whole gamification system already reads from everywhere else.
 *
 * "Your Next Unlock" — the single closest real thing the user hasn't
 * reached yet: whichever locked, auto-checkable badge has the highest
 * real progress ratio, or the next level if that's closer. Never picks
 * a manual-only badge (no real progress exists for those).
 */
export default function CampusImpactCard({ uid, className = '' }) {
  const navigate = useNavigate()
  const { progress, loading: progressLoading } = useProgress(uid)
  const [impact, setImpact] = useState(null)
  const [nextUnlock, setNextUnlock] = useState(undefined) // undefined = loading, null = none found

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    Promise.all([
      countEventsOfType(uid, 'notes_uploaded'),
      countEventsOfType(uid, 'comment_received'),
      countEventsOfType(uid, 'club_joined'),
      countEventsOfType(uid, 'lostfound_resolved')
    ]).then(([notes, helpfulReplies, communities, lostFoundResolved]) => {
      if (!cancelled) setImpact({ notes, helpfulReplies, communities, lostFoundResolved })
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    if (!uid || !progress) return
    let cancelled = false

    getEarnedBadges(uid).then(async (earned) => {
      const earnedIds = new Set(earned.map((e) => e.badgeId))
      const candidates = Object.entries(BADGES).filter(
        ([id, badge]) => !earnedIds.has(id) && badge.criteria?.type !== 'manual'
      )

      const withProgress = await Promise.all(
        candidates.map(async ([id, badge]) => {
          const p = await getBadgeProgress(uid, badge, progress).catch(() => null)
          return p ? { id, badge, progress: p, ratio: p.current / p.target } : null
        })
      )

      if (cancelled) return
      const best = withProgress.filter(Boolean).sort((a, b) => b.ratio - a.ratio)[0]

      // Compare against how close the user is to their next level — if
      // that's a closer, more immediate win, surface it instead.
      const levelRatio = (progress.currentLevelXp || 0) / Math.max(1, progress.nextLevelXp || 1)
      if (!best || levelRatio > best.ratio) {
        setNextUnlock({ type: 'level', ratio: levelRatio })
      } else {
        setNextUnlock({ type: 'badge', ...best })
      }
    })

    return () => {
      cancelled = true
    }
  }, [uid, progress])

  if (progressLoading || !progress) return null

  const impactItems = impact
    ? [
        { label: 'notes shared', value: impact.notes },
        { label: 'helpful replies', value: impact.helpfulReplies },
        { label: 'communities joined', value: impact.communities },
        { label: 'items resolved via Lost & Found', value: impact.lostFoundResolved },
        { label: 'total contributions', value: progress.contributionsCount || 0 }
      ].filter((item) => item.value > 0)
    : []

  return (
    <div className={`space-y-3 ${className}`}>
      {impact && impactItems.length > 0 && (
        <div className="rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900">Your Campus Impact</p>
          <p className="mt-0.5 text-xs text-gray-400">Real activity, not just numbers.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {impactItems.map((item) => (
              <div key={item.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-base font-bold text-gray-900">{item.value}</p>
                <p className="text-[11px] text-gray-500 leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {nextUnlock && (
        <button
          type="button"
          onClick={() => navigate(nextUnlock.type === 'level' ? '/progress' : '/badges')}
          className="w-full flex items-center justify-between rounded-2xl border border-gray-100 p-4 text-left hover:border-gray-200 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{nextUnlock.type === 'level' ? '✨' : nextUnlock.badge.emoji}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Your Next Unlock</p>
              {nextUnlock.type === 'level' ? (
                <>
                  <p className="text-sm font-bold text-gray-900">Level {progress.level + 1}</p>
                  <p className="text-xs text-gray-400">
                    {Math.max(0, (progress.nextLevelXp || 0) - (progress.currentLevelXp || 0))} XP remaining
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-900">{nextUnlock.badge.label}</p>
                  <p className="text-xs text-gray-400">
                    {Math.min(nextUnlock.progress.current, nextUnlock.progress.target)} / {nextUnlock.progress.target}
                  </p>
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      )}
    </div>
  )
}
