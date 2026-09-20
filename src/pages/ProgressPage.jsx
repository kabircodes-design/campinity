import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import { auth } from '../firebase/firebase.js'
import { useProgress } from '../gamification/useProgress.js'
import { getRecentXPEntries } from '../gamification/xpService.js'
import { ACTIVITY_LABELS, XP_REWARDS } from '../gamification/config.js'
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

  const loading = progressLoading || entries === null
  const grouped = useMemo(() => (entries ? groupByDay(entries) : []), [entries])

  const xpIntoLevel = Math.max(0, progress?.currentLevelXp || 0)
  const xpForLevel = Math.max(1, progress?.nextLevelXp || 1)
  const progressPct = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100))

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
            <span className="text-base font-bold tracking-tight text-gray-900">Your Progress</span>
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
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{progress.levelEmoji}</span>
                  <div>
                    <p className="text-lg font-bold">Level {progress.level}</p>
                    <p className="text-xs text-white/70">{progress.levelTitle}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-white/70">
                  {xpIntoLevel} / {xpForLevel} XP to Level {progress.level + 1}
                </p>
              </div>

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
