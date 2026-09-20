import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, ChevronRight, Plus, Trophy } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import BadgeDetailModal from '../components/BadgeDetailModal.jsx'
import VerifiedAchievementDetailModal from '../components/VerifiedAchievementDetailModal.jsx'
import { auth } from '../firebase/firebase.js'
import { useProgress } from '../gamification/useProgress.js'
import { BADGES, BADGE_CATEGORY_LABELS } from '../gamification/config.js'
import { getEarnedBadges, getBadgeProgress } from '../gamification/badgeService.js'
import { getMyAchievementSubmissions, getVerifiedAchievements } from '../firebase/achievementService.js'

const CATEGORY_ORDER = ['academic', 'community', 'activity', 'campus', 'special']

const SUBMISSION_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-600',
  approved: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-red-50 text-red-600'
}

/**
 * "My Achievements" — the full Campus Identity achievement dashboard.
 * Real badge collection (Earned from userBadges/{uid}/earned, Locked
 * from real per-badge progress via badgeService.getBadgeProgress, never
 * a fabricated number) PLUS Verified Campus Achievements (certificates
 * admin-approved from users/{uid}/verifiedAchievements) and a My
 * Submissions status list — kept as sections of this ONE existing page
 * (still routed at /badges, already linked from ProgressCard and
 * notifications) rather than a second achievements page, per "reuse
 * existing architecture."
 */
export default function BadgesPage() {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid
  const { progress, loading: progressLoading } = useProgress(uid)

  const [earned, setEarned] = useState(null)
  const [progressByBadge, setProgressByBadge] = useState({})
  const [selected, setSelected] = useState(null)
  const [verifiedAchievements, setVerifiedAchievements] = useState(null)
  const [submissions, setSubmissions] = useState(null)
  const [selectedAchievement, setSelectedAchievement] = useState(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getEarnedBadges(uid).then((rows) => {
      if (!cancelled) setEarned(rows)
    })
    getVerifiedAchievements(uid).then((rows) => {
      if (!cancelled) setVerifiedAchievements(rows)
    })
    getMyAchievementSubmissions(uid).then((rows) => {
      if (!cancelled) setSubmissions(rows)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    if (!uid || !progress || !earned) return
    let cancelled = false
    const earnedIds = new Set(earned.map((e) => e.badgeId))
    const lockedEntries = Object.entries(BADGES).filter(([id]) => !earnedIds.has(id))

    Promise.all(
      lockedEntries.map(async ([id, badge]) => {
        const p = await getBadgeProgress(uid, badge, progress).catch(() => null)
        return [id, p]
      })
    ).then((pairs) => {
      if (!cancelled) setProgressByBadge(Object.fromEntries(pairs))
    })

    return () => {
      cancelled = true
    }
  }, [uid, progress, earned])

  const loading = progressLoading || earned === null
  const earnedMap = new Map((earned || []).map((e) => [e.badgeId, e.earnedAt]))
  const lockedByCategory = {}
  if (earned) {
    for (const [id, badge] of Object.entries(BADGES)) {
      if (earnedMap.has(id)) continue
      const cat = badge.category || 'special'
      lockedByCategory[cat] = lockedByCategory[cat] || []
      lockedByCategory[cat].push([id, badge])
    }
  }

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
            <span className="text-base font-bold tracking-tight text-gray-900">My Achievements</span>
          </div>
        </header>

        <main className="px-4 mt-5">
          {loading ? (
            <div className="grid grid-cols-3 gap-3 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{earned.length} Earned</p>
                  <p className="text-xs text-gray-400">out of {Object.keys(BADGES).length} Campinity badges</p>
                </div>
              </div>

              {/* Verified Campus Achievements — deliberately visually
                  distinct from Campinity-earned badges below (blue
                  verification mark vs amber/emoji badge tiles), per the
                  brief's "clear distinction between a Campinity
                  Achievement and a Verified Campus Achievement." */}
              <section className="mt-7">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Verified Campus Achievements</p>
                  <button
                    type="button"
                    onClick={() => navigate('/achievements/add')}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Achievement
                  </button>
                </div>

                {verifiedAchievements === null ? (
                  <div className="mt-2 h-16 bg-gray-100 rounded-2xl animate-pulse" />
                ) : verifiedAchievements.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/achievements/add')}
                    className="mt-2 w-full flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 p-4 text-left hover:border-blue-300 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <BadgeCheck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">No verified achievements yet</p>
                      <p className="text-xs text-gray-400">Got a college certificate or recognition? Submit it for verification.</p>
                    </div>
                  </button>
                ) : (
                  <div className="mt-2 space-y-2">
                    {verifiedAchievements.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAchievement(a)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-3.5 text-left hover:border-blue-200 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                          <BadgeCheck className="w-4.5 h-4.5 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 truncate">{a.title}</p>
                          <p className="text-[11px] text-gray-500 truncate">{a.issuer}{a.year ? ` · ${a.year}` : ''}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-blue-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {submissions !== null && submissions.length > 0 && (
                <section className="mt-6">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">My Submissions</p>
                  <div className="mt-2 space-y-2">
                    {submissions.map((s) => (
                      <div key={s.id} className="rounded-xl border border-gray-100 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SUBMISSION_STATUS_STYLES[s.status] || SUBMISSION_STATUS_STYLES.pending}`}>
                            {s.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">{s.issuer}{s.year ? ` · ${s.year}` : ''}</p>
                        {s.status === 'rejected' && s.rejectionReason && (
                          <p className="mt-1 text-[11px] text-red-500">{s.rejectionReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {earned.length > 0 && (
                <section className="mt-6">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Earned</p>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {earned.map(({ badgeId, earnedAt }) => {
                      const badge = BADGES[badgeId]
                      if (!badge) return null
                      return (
                        <BadgeTile
                          key={badgeId}
                          badge={badge}
                          earned
                          onClick={() => setSelected({ badge, earnedAt, progress: null })}
                        />
                      )
                    })}
                  </div>
                </section>
              )}

              <section className="mt-7">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Badges to Unlock</p>
                {CATEGORY_ORDER.filter((cat) => lockedByCategory[cat]?.length).map((cat) => (
                  <div key={cat} className="mt-3">
                    <p className="text-xs font-semibold text-gray-500">{BADGE_CATEGORY_LABELS[cat]}</p>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      {lockedByCategory[cat].map(([id, badge]) => (
                        <BadgeTile
                          key={id}
                          badge={badge}
                          progress={progressByBadge[id]}
                          onClick={() => setSelected({ badge, earnedAt: null, progress: progressByBadge[id] })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
        </main>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      <BadgeDetailModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        badge={selected?.badge}
        earnedAt={selected?.earnedAt}
        progress={selected?.progress}
      />
      <VerifiedAchievementDetailModal
        open={Boolean(selectedAchievement)}
        onClose={() => setSelectedAchievement(null)}
        achievement={selectedAchievement}
      />
    </div>
  )
}

function BadgeTile({ badge, earned, progress, onClick }) {
  const pct = progress ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center text-center rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 ${
        earned ? 'border-amber-100 bg-amber-50/50' : 'border-gray-100 bg-white'
      }`}
    >
      <span className={`text-2xl ${earned ? '' : 'grayscale opacity-60'}`}>{badge.emoji}</span>
      <p className="mt-1.5 text-[11px] font-bold text-gray-900 leading-tight line-clamp-2">{badge.label}</p>
      {earned ? (
        <span className="mt-1 text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Unlocked</span>
      ) : progress ? (
        <div className="mt-1.5 w-full">
          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[9px] text-gray-400">{Math.min(progress.current, progress.target)}/{progress.target}</p>
        </div>
      ) : (
        <span className="mt-1 text-[9px] text-gray-300">🔒 Locked</span>
      )}
    </button>
  )
}
