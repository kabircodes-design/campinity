import { Flame, Gem, Sparkles, Trophy } from 'lucide-react'
import { useProgress } from './useProgress.js'

/**
 * Premium profile progress card, per the explicit requirement: below
 * the username, Discord/Duolingo-style rather than plain text. Every
 * number here comes from useProgress(uid) — nothing hardcoded, and a
 * brand-new user genuinely sees 0 XP / Level 1 / 0 streak / rank
 * relative to everyone else, not a placeholder.
 */
export default function ProgressCard({ uid }) {
  const { progress, loading } = useProgress(uid)

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

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow-lg shadow-blue-600/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{progress.levelEmoji}</span>
          <div>
            <p className="text-sm font-bold leading-tight">Level {progress.level}</p>
            <p className="text-[11px] text-white/70 leading-tight">{progress.levelTitle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/70">Campus Rank</p>
          <p className="text-sm font-bold">#{progress.rank}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-white/70">
          {xpIntoLevel} / {xpForLevel} XP to next level
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2 py-2 text-center">
          <Flame className="w-4 h-4 mx-auto text-orange-300" />
          <p className="mt-1 text-xs font-bold">{progress.streak}</p>
          <p className="text-[9px] text-white/60">Streak</p>
        </div>
        <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2 py-2 text-center">
          <Trophy className="w-4 h-4 mx-auto text-amber-300" />
          <p className="mt-1 text-xs font-bold">{progress.totalBadges}</p>
          <p className="text-[9px] text-white/60">Badges</p>
        </div>
        <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2 py-2 text-center">
          <Gem className="w-4 h-4 mx-auto text-cyan-300" />
          <p className="mt-1 text-xs font-bold">{progress.campusPoints}</p>
          <p className="text-[9px] text-white/60">Points</p>
        </div>
        <div className="rounded-xl bg-white/10 backdrop-blur-sm px-2 py-2 text-center">
          <Sparkles className="w-4 h-4 mx-auto text-violet-300" />
          <p className="mt-1 text-xs font-bold">{progress.reputation}</p>
          <p className="text-[9px] text-white/60">Reputation</p>
        </div>
      </div>
    </div>
  )
}
