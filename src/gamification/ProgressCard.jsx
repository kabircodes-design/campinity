import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Flame, Gem, Sparkles, Trophy } from 'lucide-react'
import { useProgress } from './useProgress.js'
import { getLeaderboardUserCount } from '../firebase/leaderboardService.js'
import StreakDetailModal from '../components/StreakDetailModal.jsx'
import PointsDetailModal from '../components/PointsDetailModal.jsx'

/**
 * The "blue leaderboard box" — every number on it comes from
 * useProgress(uid)/getLeaderboardUserCount(), nothing hardcoded.
 *
 * Restructured from a single big <button> (where clicking ANYWHERE,
 * including the 4 stat cells, just opened /leaderboard) into a shell
 * with independent clickable zones, so each stat explains itself:
 * header -> /progress (level/XP detail), Campus Rank -> /leaderboard,
 * Streak/Points -> their own detail modals, Badges -> /badges,
 * Reputation -> /reputation, footer -> /leaderboard (unchanged
 * destination). No <button> is nested inside another <button> — the
 * outer shell is a <div>.
 */
export default function ProgressCard({ uid }) {
  const navigate = useNavigate()
  const { progress, loading } = useProgress(uid)
  const [totalCount, setTotalCount] = useState(null)
  const [streakOpen, setStreakOpen] = useState(false)
  const [pointsOpen, setPointsOpen] = useState(false)

  useEffect(() => {
    getLeaderboardUserCount()
      .then(setTotalCount)
      .catch(() => {})
  }, [])

  if (loading || !progress) {
    return (
      <div className="mx-4 mt-3 rounded-2xl border border-gray-100 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="mt-3 h-2 bg-gray-100 rounded-full w-full" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const xpIntoLevel = Math.max(0, progress.currentLevelXp || 0)
  const xpForLevel = Math.max(1, progress.nextLevelXp || 1)
  const progressPct = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100))
  // Meaningless below a small population ("Top 100%" when you're the
  // only ranked student) — falls back to a neutral message instead.
  const percentile =
    totalCount && totalCount >= 5 && progress.rank
      ? Math.max(1, Math.min(99, Math.round((1 - (progress.rank - 1) / totalCount) * 100)))
      : null

  return (
    <>
      <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-lg shadow-blue-600/20">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/progress')} className="flex items-center gap-2 text-left">
            <span className="text-lg">{progress.levelEmoji}</span>
            <div>
              <p className="text-sm font-bold leading-tight">Level {progress.level}</p>
              <p className="text-[11px] text-white/70 leading-tight">{progress.levelTitle}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="text-right hover:opacity-80 transition-opacity"
          >
            <p className="text-[11px] text-white/70">Campus Rank</p>
            <p className="text-sm font-bold">#{progress.rank}</p>
          </button>
        </div>

        <button type="button" onClick={() => navigate('/progress')} className="mt-3 w-full text-left block">
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-white/70">
            {xpIntoLevel} / {xpForLevel} XP to next level
          </p>
        </button>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setStreakOpen(true)}
            className="rounded-xl bg-white/10 px-2 py-2 text-center hover:bg-white/15 transition-colors"
          >
            <Flame className="w-4 h-4 mx-auto text-orange-300" />
            <p className="mt-1 text-xs font-bold">{progress.streak}</p>
            <p className="text-[9px] text-white/60">Streak</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/badges')}
            className="rounded-xl bg-white/10 px-2 py-2 text-center hover:bg-white/15 transition-colors"
          >
            <Trophy className="w-4 h-4 mx-auto text-amber-300" />
            <p className="mt-1 text-xs font-bold">{progress.totalBadges}</p>
            <p className="text-[9px] text-white/60">Badges</p>
          </button>
          <button
            type="button"
            onClick={() => setPointsOpen(true)}
            className="rounded-xl bg-white/10 px-2 py-2 text-center hover:bg-white/15 transition-colors"
          >
            <Gem className="w-4 h-4 mx-auto text-cyan-300" />
            <p className="mt-1 text-xs font-bold">{progress.campusPoints}</p>
            <p className="text-[9px] text-white/60">Points</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reputation')}
            className="rounded-xl bg-white/10 px-2 py-2 text-center hover:bg-white/15 transition-colors"
          >
            <Sparkles className="w-4 h-4 mx-auto text-violet-300" />
            <p className="mt-1 text-xs font-bold">{progress.reputation}</p>
            <p className="text-[9px] text-white/60">Reputation</p>
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          className="mt-4 w-full flex items-center justify-between border-t border-white/15 pt-3 group"
        >
          <p className="text-[12px] font-semibold text-white/90">
            {percentile !== null ? `You're ahead of ${percentile}% of Campinity` : 'See where you rank on campus'}
          </p>
          <span className="flex items-center gap-1 text-[12px] font-bold text-white">
            View Leaderboard
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </button>
      </div>

      <StreakDetailModal
        open={streakOpen}
        onClose={() => setStreakOpen(false)}
        uid={uid}
        streak={progress.streak}
        longestStreak={progress.longestStreak}
      />
      <PointsDetailModal open={pointsOpen} onClose={() => setPointsOpen(false)} uid={uid} campusPoints={progress.campusPoints} />
    </>
  )
}
