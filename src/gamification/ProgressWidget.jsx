import { Flame } from 'lucide-react'
import { useProgress } from './useProgress.js'

/**
 * Compact Home-page widget, per the explicit spec: streak, level, XP
 * bar, nothing more — the full breakdown lives in ProgressCard on
 * Profile. Same live data source (useProgress), no duplicated logic.
 */
export default function ProgressWidget({ uid }) {
  const { progress, loading } = useProgress(uid)

  if (loading || !progress) {
    return <div className="mt-3 h-14 rounded-2xl bg-gray-100 animate-pulse" />
  }

  const xpIntoLevel = Math.max(0, progress.currentLevelXp || 0)
  const xpForLevel = Math.max(1, progress.nextLevelXp || 1)
  const progressPct = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100))

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-bold text-orange-500">
            <Flame className="w-3.5 h-3.5" fill="currentColor" />
            {progress.streak}
          </span>
          <span className="text-gray-200">|</span>
          <span className="text-xs font-bold text-gray-700">
            {progress.levelEmoji} Level {progress.level}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">{xpIntoLevel}/{xpForLevel} XP</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}
