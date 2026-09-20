import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import Avatar from '../components/Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getCollegeById } from '../data/dummyColleges.js'
import {
  LEADERBOARD_METRICS,
  getLatestBadges,
  getLeaderboard,
  getLeaderboardUserCount,
  getUserMetricRank
} from '../firebase/leaderboardService.js'

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * Dedicated leaderboard route (not a modal) — matches this app's own
 * established pattern for "drill-in from profile" destinations
 * (Followers/Following/Requests are all simple back-header pages, never
 * modals), and a modal would be cramped for podium + a scrollable full
 * ranking + a sticky current-user affordance anyway.
 *
 * Metrics: XP / Reputation / Contributions / Badges — four real,
 * server-orderable fields on userProgress (see leaderboardService.js),
 * giving different kinds of students a real way to be recognized
 * rather than one XP-only ranking.
 *
 * Ranking scope: "Global" and, only when the viewer's own profile has
 * a collegeId, "My College" — now a REAL server-side query
 * (where('collegeId','==', myCollegeId).orderBy(metric,'desc')), not a
 * client-side filter over a truncated top-100 window as before. No
 * "This Week"/"This Month" scope is offered — every one of these
 * metrics is an all-time running total with no windowed aggregate
 * available without scanning every user's full xpLog, so a real
 * weekly/monthly leaderboard isn't something this pass can honestly
 * build.
 */
export default function LeaderboardPage() {
  const navigate = useNavigate()
  const myUid = auth.currentUser?.uid

  const [metric, setMetric] = useState('xp')
  const [scope, setScope] = useState('global')
  const [entries, setEntries] = useState([])
  const [totalCount, setTotalCount] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
  const [myCollegeName, setMyCollegeName] = useState('')
  const [badgesByUid, setBadgesByUid] = useState(new Map())
  const [myMetricRank, setMyMetricRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const activeMetric = LEADERBOARD_METRICS.find((m) => m.id === metric) || LEADERBOARD_METRICS[0]

  useEffect(() => {
    if (myUid) getUserProfile(myUid).then(setMyProfile).catch(() => {})
  }, [myUid])

  useEffect(() => {
    if (!myProfile?.collegeId) return
    let cancelled = false
    getCollegeById(myProfile.collegeId)
      .then((college) => {
        if (!cancelled && college?.name) setMyCollegeName(college.name)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [myProfile?.collegeId])

  useEffect(() => {
    if (scope === 'college' && !myProfile?.collegeId) return
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      getLeaderboard({ metric, scope, collegeId: myProfile?.collegeId || null, pageSize: 100 }),
      getLeaderboardUserCount().catch(() => null),
      myUid ? getUserMetricRank({ uid: myUid, metric, scope, collegeId: myProfile?.collegeId || null }).catch(() => null) : null
    ])
      .then(([data, count, myRank]) => {
        if (cancelled) return
        setEntries(data)
        setTotalCount(count)
        setMyMetricRank(myRank)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Could not load leaderboard:', err)
        setError("Couldn't load the leaderboard.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [metric, scope, myProfile?.collegeId, myUid, reloadKey])

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)
  const myEntry = entries.find((e) => e.uid === myUid)

  useEffect(() => {
    const uids = podium.map((p) => p.uid)
    if (uids.length === 0) return
    let cancelled = false
    getLatestBadges(uids).then((map) => {
      if (!cancelled) setBadgesByUid(map)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podium.map((p) => p.uid).join(',')])

  // A percentile is meaningless with too small a population ("Top 100%"
  // when you're the only ranked student is technically the math but
  // reads as nonsense) — below this floor, show a plain "#N of M" count
  // instead (see the standing strip below), never a percentage.
  const MIN_POPULATION_FOR_PERCENTILE = 5
  const percentile = useMemo(() => {
    if (!totalCount || totalCount < MIN_POPULATION_FOR_PERCENTILE || !myMetricRank?.rank) return null
    return Math.max(1, Math.min(99, Math.round((1 - (myMetricRank.rank - 1) / totalCount) * 100)))
  }, [totalCount, myMetricRank])

  const scopes = useMemo(() => {
    const base = [{ id: 'global', label: 'Global' }]
    if (myProfile?.collegeId) base.push({ id: 'college', label: 'My College' })
    return base
  }, [myProfile?.collegeId])

  const showFloatingRank = !loading && !error && myMetricRank && !myEntry

  const goToProfile = (entry) => {
    if (entry.uid === myUid) navigate('/profile')
    else if (entry.profile.username) navigate(`/student/${entry.profile.username}`)
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
            <span className="text-base font-bold tracking-tight text-gray-900">Campus Leaderboard</span>
          </div>
        </header>

        {/* Hero */}
        <div
          className="relative overflow-hidden mx-4 mt-4 rounded-2xl px-5 py-5"
          style={{ background: 'linear-gradient(120deg, #eaf3ff 0%, #dcecff 45%, #e7f7f7 100%)' }}
        >
          <div
            className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-60 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
            aria-hidden="true"
          />
          <p className="relative flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-blue-700/70 uppercase">
            <Trophy className="w-3.5 h-3.5" /> Campus Leaderboard
          </p>
          <h1 className="relative mt-1.5 text-2xl font-bold text-gray-900 tracking-tight leading-tight">
            Compete. Connect. Get Recognized.
          </h1>
          {myCollegeName && (
            <p className="relative mt-1.5 text-sm text-gray-500">{myCollegeName}</p>
          )}
        </div>

        {/* Your standing strip — real numbers only, scoped to whichever
            metric/tab is active */}
        {!loading && !error && myMetricRank && (
          <div className="mx-4 mt-4 flex items-center gap-2.5">
            <div className="flex-1 rounded-xl border border-gray-100 px-3 py-2.5 text-center">
              <p className="text-base font-bold text-gray-900">#{myMetricRank.rank}</p>
              <p className="text-[10px] text-gray-400">{scope === 'college' ? 'Campus Rank' : 'Your Rank'}</p>
            </div>
            <div className="flex-1 rounded-xl border border-gray-100 px-3 py-2.5 text-center">
              <p className="text-base font-bold text-gray-900">{myMetricRank.value}</p>
              <p className="text-[10px] text-gray-400">Your {activeMetric.label}</p>
            </div>
            {percentile !== null ? (
              <div className="flex-1 rounded-xl border border-gray-100 px-3 py-2.5 text-center">
                <p className="text-base font-bold text-gray-900">Top {percentile}%</p>
                <p className="text-[10px] text-gray-400">of Campinity</p>
              </div>
            ) : totalCount ? (
              <div className="flex-1 rounded-xl border border-gray-100 px-3 py-2.5 text-center">
                <p className="text-base font-bold text-gray-900">of {totalCount}</p>
                <p className="text-[10px] text-gray-400">ranked students</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Metric tabs */}
        <div className="mx-4 mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {LEADERBOARD_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                metric === m.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Scope tabs */}
        {scopes.length > 1 && (
          <div className="mx-4 mt-2 flex items-center gap-2">
            {scopes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                  scope === s.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <main className="px-4 mt-5">
          {loading ? (
            <LeaderboardSkeleton />
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="mt-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-blue-500" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">
                {scope === 'college' ? 'No campus peers here yet' : 'No rankings yet'}
              </p>
              <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                {scope === 'college'
                  ? "No one from your campus has ranked here yet — keep earning to represent your campus."
                  : `Be the first to start earning ${activeMetric.label} on Campinity.`}
              </p>
            </div>
          ) : (
            <>
              {/* Podium */}
              <div className="flex items-end justify-center gap-2 mb-6">
                {[podium[1], podium[0], podium[2]].map((entry, slot) => {
                  if (!entry) return <div key={slot} className="flex-1 max-w-[110px]" />
                  const positionIndex = entry.rank - 1
                  const isFirst = positionIndex === 0
                  const badge = badgesByUid.get(entry.uid)
                  const isMe = entry.uid === myUid
                  return (
                    <PodiumSlot
                      key={entry.uid}
                      entry={entry}
                      medal={MEDALS[positionIndex]}
                      emphasized={isFirst}
                      badge={badge}
                      isMe={isMe}
                      suffix={activeMetric.suffix}
                      onClick={() => goToProfile(entry)}
                    />
                  )
                })}
              </div>

              {/* Rest of the ranking */}
              {rest.length > 0 && (
                <div className="space-y-1">
                  {rest.map((entry) => (
                    <RankRow
                      key={entry.uid}
                      entry={entry}
                      isMe={entry.uid === myUid}
                      suffix={activeMetric.suffix}
                      onClick={() => goToProfile(entry)}
                    />
                  ))}
                </div>
              )}

              <p className="mt-5 text-center text-[11px] text-gray-300">
                Showing the top {entries.length} students by {activeMetric.label.toLowerCase()}
                {scope === 'college' ? ' — filtered to your campus' : ''}.
              </p>
            </>
          )}
        </main>
      </div>

      {/* Sticky "Your Rank" — only when the viewer isn't visible in the
          currently rendered scope, so they never have to wonder where
          they stand. */}
      {showFloatingRank && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-6 z-50 px-4 w-full max-w-[400px]">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-xl">
            <Avatar
              initials={getInitials(myProfile?.displayName || '')}
              colorClass={getAvatarColor(myUid)}
              size="sm"
              src={getProfileIdentityImage(myProfile) || undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60">Your Rank</p>
              <p className="text-sm font-bold truncate">
                #{myMetricRank.rank} · {myMetricRank.value} {activeMetric.suffix}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

function PodiumSlot({ entry, medal, emphasized, badge, isMe, suffix, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 max-w-[130px] flex flex-col items-center text-center rounded-2xl border p-3 transition-all duration-200 hover:-translate-y-0.5 ${
        emphasized ? 'border-blue-200 bg-blue-50/60 pt-2 pb-4' : 'border-gray-100 bg-white'
      } ${isMe ? 'ring-2 ring-blue-500' : ''}`}
    >
      <span className={emphasized ? 'text-3xl' : 'text-2xl'}>{medal}</span>
      <div className="mt-1">
        <Avatar
          initials={getInitials(entry.profile.displayName)}
          colorClass={getAvatarColor(entry.uid)}
          size={emphasized ? 'lg' : 'md'}
          src={getProfileIdentityImage(entry.profile) || undefined}
        />
      </div>
      <p className="mt-2 text-sm font-bold text-gray-900 truncate w-full">{entry.profile.displayName || 'Student'}</p>
      {entry.profile.username && <p className="text-[11px] text-gray-400 truncate w-full">@{entry.profile.username}</p>}
      <p className="mt-1 text-xs font-semibold text-blue-600">{entry.value} {suffix}</p>
      {badge && (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-0.5 truncate max-w-full">
          {badge.emoji} {badge.label}
        </span>
      )}
      {isMe && <span className="mt-1 text-[9px] font-bold text-blue-600 uppercase tracking-wide">You</span>}
    </button>
  )
}

function RankRow({ entry, isMe, suffix, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-150 ${
        isMe ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <span className={`w-7 flex-shrink-0 text-xs font-bold text-center ${isMe ? 'text-blue-600' : 'text-gray-400'}`}>
        {entry.rank}
      </span>
      <Avatar
        initials={getInitials(entry.profile.displayName)}
        colorClass={getAvatarColor(entry.uid)}
        size="sm"
        src={getProfileIdentityImage(entry.profile) || undefined}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm truncate ${isMe ? 'font-bold text-blue-700' : 'font-semibold text-gray-900'}`}>
          {isMe ? 'You' : entry.profile.displayName || 'Student'}
        </p>
        {entry.profile.username && <p className="text-[11px] text-gray-400 truncate">@{entry.profile.username}</p>}
      </div>
      <span className="flex-shrink-0 text-sm font-bold text-gray-900">
        {entry.value} <span className="text-[10px] font-medium text-gray-400">{suffix}</span>
      </span>
    </button>
  )
}

function LeaderboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-end justify-center gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex-1 max-w-[130px] rounded-2xl bg-gray-100 ${i === 1 ? 'h-40' : 'h-32'}`} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
