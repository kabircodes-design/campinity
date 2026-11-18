import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Flame, Gem, Sparkles, Trophy } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import { auth } from '../firebase/firebase.js'
import { useProgress } from '../gamification/useProgress.js'
import { getRecentXPEntries } from '../gamification/xpService.js'
import { getEarnedBadges } from '../gamification/badgeService.js'
import { ACTIVITY_LABELS, BADGES, XP_REWARDS } from '../gamification/config.js'
import { formatTimeAgo } from '../firebase/postService.js'

function groupByDay(entries) {
  const groups = []
  let lastKey = null
  for (const entry of entries) {
    const date = entry.createdAt?.toDate ? entry.createdAt.toDate() : null
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    let label = 'Earlier'
    if (date) {
      const isSameDay = (a, b) => a.toDateString() === b.toDateString()
      if (isSameDay(date, today)) label = 'Today'
      else if (isSameDay(date, yesterday)) label = 'Yesterday'
      else label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }
    if (label !== lastKey) {
      groups.push({ label, entries: [] })
      lastKey = label
    }
    groups[groups.length - 1].entries.push(entry)
  }
  return groups
}

/**
 * "Why do I have this level/XP" — real level math (reused directly
 * from useProgress, not recomputed), real Recent XP + full History
 * from xpLog, and a real "Ways to earn XP" list sourced straight from
 * XP_REWARDS in config.js.
 */
export default function ProgressPage() {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid
  const { progress, loading: progressLoading } = useProgress(uid)
  const [entries, setEntries] = useState(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getRecentXPEntries(uid, 50).then((rows) => {
      if (!cancelled) setEntries(rows)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  // Earned achievements — the same userBadges data the Badges page
  // reads; only badges that still exist in config are shown.
  const [earnedBadges, setEarnedBadges] = useState(null)
  useEffect(() => {
    if (!uid) return undefined
    let cancelled = false
    getEarnedBadges(uid)
      .then((rows) => {
        if (!cancelled) setEarnedBadges(rows.filter((row) => BADGES[row.badgeId]))
      })
      .catch(() => {
        if (!cancelled) setEarnedBadges([])
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  const loading = progressLoading || entries === null
  const grouped = useMemo(() => (entries ? groupByDay(entries) : []), [entries])

  const xpIntoLevel = Math.max(0, progress?.currentLevelXp || 0)
  const xpForLevel = Math.max(1, progress?.nextLevelXp || 1)
  const progressPct = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100))
  const xpRemaining = Math.max(0, xpForLevel - xpIntoLevel)

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[560px] lg:max-w-[640px] bg-white min-h-screen lg:shadow-sm lg:border-x lg:border-gray-100 pb-24">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="flex-1 text-base font-bold tracking-tight text-gray-900">Campus Rank</span>
            <button
              type="button"
              aria-label="Leaderboard"
              onClick={() => navigate('/leaderboard')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-amber-500 hover:bg-amber-50 transition-all duration-300"
            >
              <Trophy className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="px-4 mt-5">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-28 bg-gray-100 rounded-2xl" />
              <div className="h-40 bg-gray-100 rounded-2xl" />
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 px-5 pt-6 pb-5 text-white text-center shadow-lg shadow-blue-600/20">
                <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
                <div className="absolute -bottom-14 -left-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" aria-hidden="true" />
                <div className="relative mx-auto w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-amber-300" strokeWidth={1.8} />
                </div>
                <p className="relative mt-3 text-[28px] font-bold leading-none tracking-tight">Level {progress.level}</p>
                <p className="relative mt-1.5 text-sm font-semibold text-white/85">
                  {progress.levelTitle} {progress.levelEmoji}
                </p>
                <div
                  className="relative mt-4 h-2.5 rounded-full bg-white/20 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={xpForLevel}
                  aria-valuenow={xpIntoLevel}
                  aria-label={`XP towards level ${progress.level + 1}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-300 to-white transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="relative mt-2 flex items-center justify-between text-xs text-white/80">
                  <span>
                    {xpIntoLevel} / {xpForLevel} XP
                  </span>
                  <span>
                    {xpRemaining} XP to Level {progress.level + 1}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/leaderboard')}
                  className="relative mt-4 w-full flex items-center justify-between rounded-2xl bg-white/10 hover:bg-white/20 px-4 py-2.5 text-left transition-colors duration-200"
                >
                  <span>
                    <span className="block text-[11px] text-white/70">Campus Rank</span>
                    <span className="block text-base font-bold leading-tight">{progress.rank ? `#${progress.rank}` : '—'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold">
                    View Leaderboard
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <div className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <Flame className="w-5 h-5 mx-auto text-orange-500" />
                  <p className="mt-1.5 text-sm font-bold text-gray-900">{progress.streak ?? 0}</p>
                  <p className="text-[10px] text-gray-400">Streak</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/badges')}
                  className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-100 transition-colors duration-200"
                >
                  <Trophy className="w-5 h-5 mx-auto text-amber-500" />
                  <p className="mt-1.5 text-sm font-bold text-gray-900">{progress.totalBadges ?? 0}</p>
                  <p className="text-[10px] text-gray-400">Badges</p>
                </button>
                <div className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <Gem className="w-5 h-5 mx-auto text-cyan-500" />
                  <p className="mt-1.5 text-sm font-bold text-gray-900">{progress.campusPoints ?? 0}</p>
                  <p className="text-[10px] text-gray-400">Points</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/reputation')}
                  className="rounded-2xl border border-gray-100 bg-white px-2 py-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-100 transition-colors duration-200"
                >
                  <Sparkles className="w-5 h-5 mx-auto text-violet-500" />
                  <p className="mt-1.5 text-sm font-bold text-gray-900">{progress.reputation ?? 0}</p>
                  <p className="text-[10px] text-gray-400">Reputation</p>
                </button>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <p className="text-base font-bold text-gray-900">Achievements</p>
                <button
                  type="button"
                  onClick={() => navigate('/badges')}
                  className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-blue-600"
                >
                  See All
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {earnedBadges === null ? (
                <div className="mt-2 grid grid-cols-4 gap-2 animate-pulse">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-gray-100" />
                  ))}
                </div>
              ) : earnedBadges.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/badges')}
                  className="mt-2 w-full rounded-2xl border border-dashed border-gray-200 px-4 py-5 text-center hover:border-blue-200 transition-colors duration-200"
                >
                  <p className="text-sm font-semibold text-gray-900">No achievements yet</p>
                  <p className="mt-0.5 text-xs text-gray-400">See what you can unlock.</p>
                </button>
              ) : (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {earnedBadges.slice(0, 4).map((row) => {
                    const badge = BADGES[row.badgeId]
                    return (
                      <button
                        key={row.badgeId}
                        type="button"
                        onClick={() => navigate('/badges')}
                        className="rounded-2xl border border-gray-100 bg-white px-1.5 py-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-blue-100 transition-colors duration-200"
                      >
                        <span className="block text-2xl leading-none" aria-hidden="true">
                          {badge.emoji}
                        </span>
                        <span className="mt-1.5 block text-[10px] font-semibold text-gray-700 leading-tight line-clamp-2">{badge.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              <p className="mt-6 text-[11px] font-bold uppercase tracking-wide text-gray-400">Ways to earn XP</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(XP_REWARDS).map(([type, amount]) => (
                  <div key={type} className="rounded-xl border border-gray-100 px-3 py-2.5">
                    <p className="text-xs text-gray-600 leading-snug">{ACTIVITY_LABELS[type] || type}</p>
                    <p className="mt-0.5 text-sm font-bold text-blue-600">+{amount} XP</p>
                  </div>
                ))}
              </div>

              <p className="mt-7 text-[11px] font-bold uppercase tracking-wide text-gray-400">XP History</p>
              {entries.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400 py-4">No XP earned yet — start posting, commenting, or joining a community.</p>
              ) : (
                grouped.map((group) => (
                  <div key={group.label} className="mt-4">
                    <p className="text-xs font-semibold text-gray-400">{group.label}</p>
                    <div className="mt-1.5 space-y-1.5">
                      {group.entries.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3.5 py-2.5">
                          <div>
                            <p className="text-sm text-gray-800">{ACTIVITY_LABELS[entry.activityType] || entry.activityType}</p>
                            <p className="text-[10px] text-gray-400">{formatTimeAgo(entry.createdAt)}</p>
                          </div>
                          <span className="text-sm font-bold text-blue-600">+{entry.xpAwarded} XP</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
