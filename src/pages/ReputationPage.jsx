import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import { auth } from '../firebase/firebase.js'
import { useProgress } from '../gamification/useProgress.js'
import { getReputationBreakdown } from '../gamification/xpService.js'
import { ACTIVITY_LABELS, REPUTATION_ACTION_REWARDS, REPUTATION_VERIFIED_CAMPUS_BONUS } from '../gamification/config.js'

const IMPROVEMENT_TIPS = [
  ...Object.keys(REPUTATION_ACTION_REWARDS).map((type) => `Get more ${ACTIVITY_LABELS[type]?.toLowerCase() || type.replace(/_/g, ' ')} on your posts`),
  `Get your campus verified (+${REPUTATION_VERIFIED_CAMPUS_BONUS})`
]

/**
 * "Why do I have this reputation" — a real, itemized breakdown from
 * xpLog (see getReputationBreakdown in xpService.js), not an
 * unexplained number. Categories with zero real entries are shown as
 * "not yet tracked" rather than hidden or faked, matching "if some
 * category is not currently tracked, show it as unavailable."
 */
export default function ReputationPage() {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid
  const { progress, loading: progressLoading } = useProgress(uid)
  const [breakdown, setBreakdown] = useState(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getReputationBreakdown(uid).then((rows) => {
      if (!cancelled) setBreakdown(rows)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  const loading = progressLoading || breakdown === null

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
            <span className="text-base font-bold tracking-tight text-gray-900">Your Reputation</span>
          </div>
        </header>

        <main className="px-4 mt-5">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-20 bg-gray-100 rounded-2xl" />
              <div className="h-40 bg-gray-100 rounded-2xl" />
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-200" />
                  <p className="text-sm font-semibold text-white/80">Current Reputation</p>
                </div>
                <p className="mt-1 text-4xl font-bold">{progress.reputation}</p>
                <p className="mt-1 text-xs text-white/70">
                  Reputation reflects how valuable and trustworthy you are to your campus — not how active you are.
                  That's what XP measures.
                </p>
              </div>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-wide text-gray-400">Why you have this reputation</p>
              <div className="mt-2 space-y-2">
                {breakdown.map((row) => (
                  <div key={row.category} className="flex items-center justify-between rounded-xl border border-gray-100 px-3.5 py-3">
                    <span className="text-sm text-gray-700">{row.category}</span>
                    {row.notApplicable ? (
                      <span className="text-xs text-gray-300 italic">Not yet tracked</span>
                    ) : (
                      <span className={`text-sm font-bold ${row.total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {row.total >= 0 ? '+' : ''}
                        {row.total}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-6 text-[11px] font-bold uppercase tracking-wide text-gray-400">How to increase your reputation</p>
              <div className="mt-2 space-y-1.5">
                {IMPROVEMENT_TIPS.map((tip) => (
                  <div key={tip} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    {tip}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
                Reputation only moves when other students engage with what you create — likes, replies, and campus
                verification. Liking or messaging others yourself doesn't change your own reputation.
                {progress.reputation < 0 && ' A negative reputation reflects a past moderation action on your account.'}
              </p>
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
