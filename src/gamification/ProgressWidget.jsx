import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { useProgress } from './useProgress.js'

/**
 * Compact Home-page widget, per the explicit spec: streak, level, XP
 * bar, nothing more — the full breakdown lives in ProgressCard on
 * Profile. Same live data source (useProgress), no duplicated logic,
 * no new fields invented — every number here (streak, level,
 * levelEmoji, xpIntoLevel, xpForLevel) already existed in the real
 * progress object.
 */
export default function ProgressWidget({ uid }) {
  const { progress, loading } = useProgress(uid)
  const [animatedPct, setAnimatedPct] = useState(0)

  const xpIntoLevel = Math.max(0, progress?.currentLevelXp || 0)
  const xpForLevel = Math.max(1, progress?.nextLevelXp || 1)
  const targetPct = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100))

  // Real fill animation on mount/data-ready — starts at 0, animates
  // to the actual value once, matching "progress bar animates" on
  // load without faking the underlying number.
  useEffect(() => {
    if (loading || !progress) return
    setAnimatedPct(0)
    const timer = window.setTimeout(() => setAnimatedPct(targetPct), 80)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, progress?.level, targetPct])

  if (loading || !progress) {
    return <div className="mt-3 h-16 rounded-2xl bg-gray-100 animate-pulse" />
  }

  return (
    <div className="mt-3 rounded-2xl bg-gradient-to-br from-gray-900 via-slate-900 to-indigo-950 px-4 py-3.5 relative overflow-hidden">
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
            <Flame className="w-3.5 h-3.5" fill="currentColor" />
            {progress.streak}
          </span>
          <span className="text-white/15">|</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-white">
            <span className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-[11px] shadow-[0_0_10px_rgba(99,102,241,0.5)]">
              {progress.levelEmoji}
            </span>
            Level {progress.level}
          </span>
        </div>
        <span className="text-[10px] text-white/50 font-medium">{xpIntoLevel}/{xpForLevel} XP</span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-700 ease-out"
          style={{ width: `${animatedPct}%` }}
        />
      </div>
    </div>
  )
}
