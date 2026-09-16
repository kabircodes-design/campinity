import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Check, Plus, Search, Sparkles, TrendingUp, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import {
  getCollegeCommunities,
  getTrendingCommunities,
  getUserCommunityMemberships,
  getUserPendingRequests,
  searchCommunitiesByCategory,
  searchCommunitiesByName
} from '../firebase/communityService.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { useAuth } from '../context/AuthContext.jsx'

// Real types, taken directly from CommunityCard.jsx's own typeLabels
// — not invented. "All" is added as the default/unfiltered option.
const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'official_club', label: 'Clubs' },
  { id: 'study_group', label: 'Study' },
  { id: 'society', label: 'Society' },
  { id: 'event', label: 'Events' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'branch', label: 'Branch' },
  { id: 'batch', label: 'Batch' }
]

/**
 * Full redesign to match the rest of the rebuilt app (Home, Lost &
 * Found, Messages, Marketplace) — clean white surfaces, blue accent,
 * no glassmorphism, no dark theme. This was the last page still on the
 * old purple/lavender `#f3f0fb` + ambient-glow-layer theme.
 *
 * All data fetching/state (trending communities, membership states,
 * pending requests, debounced search) is unchanged from before this
 * pass — presentation only. "Trending on Campus" in the right rail is
 * the same already-fetched, membersCount-sorted list this page already
 * has (getTrendingCommunities orders by membersCount desc server-side)
 * — zero new query, zero fabricated activity metric.
 */
export default function DiscoverCommunitiesPage() {
  const navigate = useNavigate()
  const [communities, setCommunities] = useState([])
  const [membershipStates, setMembershipStates] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [campusCommunities, setCampusCommunities] = useState([])
  const [categoryResults, setCategoryResults] = useState(null)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const { profile } = useAuth()

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid
    setLoading(true)
    setLoadError('')

    Promise.all([
      getTrendingCommunities({ pageSize: 40 }),
      uid ? getUserCommunityMemberships(uid).catch(() => []) : Promise.resolve([]),
      uid ? getUserPendingRequests(uid).catch(() => []) : Promise.resolve([])
    ])
      .then(([communitiesData, memberships, pendingRequests]) => {
        if (cancelled) return
        setCommunities(communitiesData)
        const states = new Map()
        memberships.forEach((m) => states.set(m.communityId, m.role === 'owner' ? 'owner' : 'member'))
        pendingRequests.forEach((r) => {
          if (!states.has(r.communityId)) states.set(r.communityId, 'pending')
        })
        setMembershipStates(states)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Could not load communities:', err)
        setLoadError("Couldn't load communities.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // "For Your Campus" — real, server-side, college-scoped query
  // (getCollegeCommunities already existed, unused by this page until
  // now). Separate effect keyed on profile?.collegeId rather than
  // folded into the effect above: profile loads asynchronously from
  // AuthContext and may not be ready on first mount, so this simply
  // re-fires once it is, instead of the page needing to coordinate two
  // different loading conditions in one effect.
  useEffect(() => {
    if (!profile?.collegeId) {
      setCampusCommunities([])
      return
    }
    let cancelled = false
    getCollegeCommunities(profile.collegeId)
      .then((data) => {
        if (!cancelled) setCampusCommunities(data)
      })
      .catch(() => {
        if (!cancelled) setCampusCommunities([])
      })
    return () => {
      cancelled = true
    }
  }, [profile?.collegeId])

  // Category chips now query the real, unbounded, server-side
  // searchCommunitiesByCategory() instead of client-filtering the
  // capped 40-item trending list below — a study group ranked #55 by
  // members was previously undiscoverable through this filter no
  // matter what, since it would never be in that top-40 set at all.
  useEffect(() => {
    if (typeFilter === 'all') {
      setCategoryResults(null)
      return
    }
    let cancelled = false
    setCategoryLoading(true)
    searchCommunitiesByCategory(typeFilter)
      .then((data) => {
        if (!cancelled) setCategoryResults(data)
      })
      .catch(() => {
        if (!cancelled) setCategoryResults([])
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [typeFilter])

  // Search is local to this page — a real Firestore query
  // (searchCommunitiesByName), completely separate from the app's
  // global search, never touching it.
  useEffect(() => {
    const term = searchTerm.trim()
    if (!term) {
      setSearchResults(null)
      return undefined
    }
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchCommunitiesByName(term)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  const filteredCommunities = useMemo(() => {
    // Actively text-searching: keep filtering that (already small,
    // already-fetched) result set client-side by type — introducing a
    // second server query here would just race the name search for no
    // benefit. Only when NOT text-searching does a type filter use the
    // real category query above (categoryResults).
    if (searchResults !== null) {
      return typeFilter === 'all' ? searchResults : searchResults.filter((c) => c.type === typeFilter)
    }
    if (typeFilter !== 'all') return categoryResults || []
    return communities
  }, [communities, searchResults, typeFilter, categoryResults])

  // "Your Communities" is derived from the already-fetched trending
  // list filtered by membership, NOT a second Firestore fetch — this
  // means it only shows joined communities that also happen to appear
  // in the trending set, a stated trade-off in exchange for not
  // introducing an extra query just for this section.
  const yourCommunities = useMemo(
    () => communities.filter((c) => {
      const state = membershipStates.get(c.id)
      return state === 'owner' || state === 'member'
    }),
    [communities, membershipStates]
  )
  const discoverCommunities = useMemo(
    () => filteredCommunities.filter((c) => !membershipStates.has(c.id) || membershipStates.get(c.id) === 'pending'),
    [filteredCommunities, membershipStates]
  )
  const trendingCommunities = useMemo(() => communities.slice(0, 5), [communities])

  const quickStats = useMemo(
    () => [
      { key: 'total', label: 'Communities', value: communities.length, tint: 'bg-blue-50 text-blue-600', icon: Users },
      { key: 'yours', label: 'Yours', value: yourCommunities.length, tint: 'bg-emerald-50 text-emerald-600', icon: Check },
      { key: 'new', label: 'New This Week', value: communities.filter((c) => c.createdAt?.toMillis && Date.now() - c.createdAt.toMillis() < 7 * 24 * 60 * 60 * 1000).length, tint: 'bg-pink-50 text-pink-600', icon: Sparkles }
    ],
    [communities, yourCommunities]
  )

  const isSearchingOrFiltering = searchTerm.trim() || typeFilter !== 'all'

  return (
    <div className="h-full lg:grid lg:gap-3 lg:[grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
      <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
          <div className="mx-auto max-w-[560px] lg:max-w-[820px] px-4 lg:px-6 pt-5 pb-24">
            {/* Hero */}
            <div
              className="relative overflow-hidden rounded-2xl lg:rounded-3xl px-5 py-5 lg:px-7 lg:py-6 mb-4"
              style={{ background: 'linear-gradient(120deg, #eaf3ff 0%, #dcecff 45%, #e7f7f7 100%)' }}
            >
              <div
                className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-60 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-12 right-10 w-32 h-32 rounded-full opacity-50 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)' }}
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-blue-700/70 uppercase">
                    <Users className="w-3.5 h-3.5" /> Communities
                  </p>
                  <h1 className="mt-1.5 text-2xl lg:text-[28px] font-bold text-gray-900 tracking-tight leading-tight max-w-sm">
                    Find your people.
                  </h1>
                  <p className="mt-2 text-[13px] lg:text-sm text-gray-500 max-w-sm leading-relaxed">
                    Discover communities, clubs and campus groups that feel like home.
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => navigate('/community/create')}
                      className="flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" /> Create Community
                    </button>
                  </div>
                </div>

                <div className="relative hidden sm:flex flex-shrink-0 items-end gap-2 pb-1">
                  <span className="w-11 h-11 rounded-2xl bg-white/70 border border-white flex items-center justify-center text-blue-600 shadow-sm -rotate-6">
                    <Users className="w-5 h-5" />
                  </span>
                  <span className="w-14 h-14 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-blue-700 shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </span>
                  <span className="w-11 h-11 rounded-2xl bg-white/70 border border-white flex items-center justify-center text-teal-600 shadow-sm rotate-6">
                    <TrendingUp className="w-5 h-5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search communities..."
                aria-label="Search communities"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
              />
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scroll-hidden">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                    typeFilter === f.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : loadError ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">{loadError}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : communities.length === 0 && !searchTerm ? (
              <div className="py-16 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">No communities here yet</p>
                <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                  Be the first to bring people together.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/community/create')}
                  className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                >
                  Create Community
                </button>
              </div>
            ) : (
              <>
                {!isSearchingOrFiltering && yourCommunities.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2.5 text-sm font-bold text-gray-900">Your Communities</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {yourCommunities.map((community) => (
                        <CommunityCard key={community.id} community={community} membershipState={membershipStates.get(community.id)} />
                      ))}
                    </div>
                  </div>
                )}

                {!isSearchingOrFiltering && campusCommunities.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2.5 text-sm font-bold text-gray-900">For Your Campus</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {campusCommunities.slice(0, 6).map((community) => (
                        <CommunityCard
                          key={community.id}
                          community={community}
                          membershipState={membershipStates.get(community.id) || null}
                          onStateChange={(id, newState) =>
                            setMembershipStates((prev) => new Map(prev).set(id, newState))
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {searching || categoryLoading ? (
                  <div className="py-10 flex justify-center">
                    <Loader size="sm" tone="dark" />
                  </div>
                ) : discoverCommunities.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                      <Search className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">
                      {isSearchingOrFiltering ? 'No communities found' : 'No more communities to discover'}
                    </p>
                    <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                      {isSearchingOrFiltering ? 'Try a different name or category.' : 'Check back soon, or start your own.'}
                    </p>
                  </div>
                ) : (
                  <div>
                    {!isSearchingOrFiltering ? (
                      <p className="mb-2.5 text-sm font-bold text-gray-900">
                        {yourCommunities.length > 0 || campusCommunities.length > 0 ? 'Popular Communities' : 'Discover Communities'}
                      </p>
                    ) : typeFilter !== 'all' ? (
                      <p className="mb-2.5 text-sm font-bold text-gray-900">{TYPE_FILTERS.find((f) => f.id === typeFilter)?.label}</p>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {discoverCommunities.map((community) => (
                        <CommunityCard
                          key={community.id}
                          community={community}
                          membershipState={membershipStates.get(community.id) || null}
                          onStateChange={(id, newState) =>
                            setMembershipStates((prev) => new Map(prev).set(id, newState))
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right rail */}
        <aside className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 h-screen sticky top-0 overflow-y-auto px-4 py-5 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-500" /> Quick Stats
            </p>
            <div className="grid grid-cols-3 gap-2">
              {quickStats.map(({ key, icon: Icon, value, label, tint }) => (
                <div key={key} className="rounded-xl bg-gray-50/70 px-2 py-3 text-center">
                  <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center ${tint}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <p className="mt-1.5 text-base font-bold text-gray-900 leading-none">{value}</p>
                  <p className="mt-1 text-[10px] text-gray-400 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {trendingCommunities.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Trending on Campus
              </p>
              <div className="space-y-1.5">
                {trendingCommunities.map((community, i) => (
                  <button
                    key={community.id}
                    type="button"
                    onClick={() => navigate(`/community/${community.id}`)}
                    className="w-full flex items-center gap-2.5 text-left group rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-all duration-200"
                  >
                    <span className="text-[11px] font-bold text-gray-300 w-3 flex-shrink-0">{i + 1}</span>
                    <Avatar
                      initials={getInitials(community.name)}
                      colorClass={getAvatarColor(community.id)}
                      size="sm"
                      src={community.icon || undefined}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors duration-200">
                        {community.name}
                      </p>
                      <p className="text-xs text-gray-400">{community.membersCount} members</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ backgroundColor: '#1677ff' }}>
            <p className="relative flex items-center gap-1.5 text-sm font-bold">
              <Sparkles className="w-4 h-4" /> Start your own community
            </p>
            <p className="relative mt-1.5 text-xs text-blue-100 leading-relaxed">
              Have a club, project or campus idea? Bring people together.
            </p>
            <button
              type="button"
              onClick={() => navigate('/community/create')}
              className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 active:scale-[0.98] transition-all duration-200"
            >
              Create Community →
            </button>
          </div>
        </aside>
    </div>
  )
}
