import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, BarChart3, Check, Search, Sparkles, TrendingUp, Users, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
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
// 'official_club' deliberately excluded — Clubs has its own segment,
// and the Communities list already filters that type out (clubFilter).
const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'study_group', label: 'Study' },
  { id: 'society', label: 'Society' },
  { id: 'event', label: 'Events' },
  { id: 'hostel', label: 'Hostel' },
  { id: 'branch', label: 'Branch' },
  { id: 'batch', label: 'Batch' }
]

function SectionTitle({ children, count }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">{children}</h2>
      {typeof count === 'number' && <span className="text-xs text-gray-400 flex-shrink-0">{count}</span>}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3.5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-3 w-1/3 rounded-full bg-gray-100 animate-pulse" />
        </div>
        <div className="w-16 h-8 rounded-full bg-gray-100 animate-pulse" />
      </div>
      <div className="mt-3 h-3 w-5/6 rounded-full bg-gray-100 animate-pulse" />
    </div>
  )
}

function StatePanel({ icon: Icon, tone = 'blue', title, body, action }) {
  return (
    <div className="py-12 px-6 text-center">
      <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="mt-3 text-[15px] font-semibold text-gray-900">{title}</p>
      {body && <p className="mt-1 text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">{body}</p>}
      {action}
    </div>
  )
}

/**
 * Community / club discovery, rendered inside CommunitiesHubPage (which
 * owns the page header and the create action).
 *
 * Data is unchanged from before the redesign: trending (membersCount
 * desc), the viewer's memberships + pending requests, the college-scoped
 * "For your campus" query, the server-side category query and the
 * debounced name search. Nothing is fabricated: every section only
 * renders when its real query returned something.
 *
 * `clubsOnly`: the SAME component and queries, filtered client-side to
 * type 'official_club' (a club is a community of that type), so any fix
 * here applies to both segments.
 */
export default function DiscoverCommunitiesPage({ clubsOnly = false } = {}) {
  const navigate = useNavigate()
  const clubFilter = (list) => list.filter((c) => (clubsOnly ? c.type === 'official_club' : c.type !== 'official_club'))
  const [communities, setCommunities] = useState([])
  const [membershipStates, setMembershipStates] = useState(new Map())
  // Communities the viewer had already joined when the page loaded. They
  // live in "Your communities"; ones joined from this screen stay where
  // they are and flip to "Joined" instead of vanishing mid-tap.
  const [joinedAtLoad, setJoinedAtLoad] = useState(new Set())
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
        setJoinedAtLoad(new Set(memberships.map((m) => m.communityId)))
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

  // "For your campus" — real, server-side, college-scoped query. Keyed
  // on profile?.collegeId because the profile loads asynchronously.
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

  // Category chips query the real, unbounded searchCommunitiesByCategory()
  // rather than client-filtering the capped trending list.
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

  // Page-local name search (searchCommunitiesByName), debounced.
  useEffect(() => {
    const term = searchTerm.trim()
    if (!term) {
      setSearchResults(null)
      setSearching(false)
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
    // While text-searching, the (small) result set is type-filtered
    // client-side; otherwise a type filter uses the category query.
    if (searchResults !== null) {
      const base = clubFilter(searchResults)
      return typeFilter === 'all' ? base : base.filter((c) => c.type === typeFilter)
    }
    if (typeFilter !== 'all') return clubFilter(categoryResults || [])
    return clubFilter(communities)
  }, [communities, searchResults, typeFilter, categoryResults, clubsOnly])

  // "Your communities" — derived from the already-fetched trending list
  // plus the campus list (no extra query), filtered by membership.
  const yourCommunities = useMemo(() => {
    const seen = new Set()
    return clubFilter([...communities, ...campusCommunities]).filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      const state = membershipStates.get(c.id)
      return state === 'owner' || state === 'member'
    })
  }, [communities, campusCommunities, membershipStates, clubsOnly])

  const isSearchingOrFiltering = Boolean(searchTerm.trim()) || typeFilter !== 'all'

  const discoverCommunities = useMemo(
    () => (isSearchingOrFiltering ? filteredCommunities : filteredCommunities.filter((c) => !joinedAtLoad.has(c.id))),
    [filteredCommunities, joinedAtLoad, isSearchingOrFiltering]
  )
  const trendingCommunities = useMemo(() => clubFilter(communities).slice(0, 5), [communities, clubsOnly])
  const filteredCampusCommunities = useMemo(
    () => clubFilter(campusCommunities).filter((c) => !joinedAtLoad.has(c.id)).slice(0, 6),
    [campusCommunities, joinedAtLoad, clubsOnly]
  )
  const campusIds = useMemo(() => new Set(filteredCampusCommunities.map((c) => c.id)), [filteredCampusCommunities])
  // Don't list the same community twice on the default view.
  const popularCommunities = useMemo(
    () => discoverCommunities.filter((c) => isSearchingOrFiltering || !campusIds.has(c.id)),
    [discoverCommunities, campusIds, isSearchingOrFiltering]
  )

  const quickStats = useMemo(
    () => [
      { key: 'total', label: clubsOnly ? 'Clubs' : 'Communities', value: clubFilter(communities).length, tint: 'bg-blue-50 text-blue-600', icon: Users },
      { key: 'yours', label: 'Yours', value: yourCommunities.length, tint: 'bg-emerald-50 text-emerald-600', icon: Check },
      { key: 'new', label: 'New This Week', value: clubFilter(communities).filter((c) => c.createdAt?.toMillis && Date.now() - c.createdAt.toMillis() < 7 * 24 * 60 * 60 * 1000).length, tint: 'bg-pink-50 text-pink-600', icon: Sparkles }
    ],
    [communities, yourCommunities, clubsOnly]
  )

  const hasAnyBaseResults = clubFilter(communities).length > 0 || filteredCampusCommunities.length > 0
  const noun = clubsOnly ? 'clubs' : 'communities'
  const createPath = clubsOnly ? '/club/create' : '/community/create'
  const openCommunity = (c) => navigate(c.type === 'official_club' ? `/club/${c.id}` : `/community/${c.id}`)
  const updateState = (id, newState) => setMembershipStates((prev) => new Map(prev).set(id, newState))
  const resultsLoading = searching || categoryLoading

  const renderCards = (list) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {list.map((community) => (
        <CommunityCard
          key={community.id}
          community={community}
          membershipState={membershipStates.get(community.id) || null}
          onStateChange={updateState}
        />
      ))}
    </div>
  )

  return (
    <div className="h-full lg:grid lg:gap-3 lg:[grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
      <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
        <div className="mx-auto max-w-[560px] lg:max-w-[820px] px-4 lg:px-6 pt-3 pb-32 lg:pb-8">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={`Search ${noun}...`}
              aria-label={`Search ${noun}`}
              enterKeyHint="search"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category filters — Communities only (clubs have no sub-type). */}
          {!clubsOnly && (
            <div className="-mx-4 px-4 mt-3 flex items-center gap-2 overflow-x-auto scroll-hidden" role="tablist" aria-label="Community type">
              {TYPE_FILTERS.map((f) => {
                const isActive = typeFilter === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTypeFilter(f.id)}
                    className={`flex-shrink-0 rounded-full text-[13px] font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-5">
            {loading ? (
              <div className="space-y-2.5" aria-busy="true" aria-label={`Loading ${noun}`}>
                <div className="h-4 w-32 rounded-full bg-gray-100 animate-pulse mb-3" />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : loadError ? (
              <StatePanel
                icon={AlertCircle}
                tone="red"
                title={loadError}
                body="Check your connection and try again."
                action={
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="mt-4 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-200"
                  >
                    Try again
                  </button>
                }
              />
            ) : !hasAnyBaseResults && !isSearchingOrFiltering ? (
              <StatePanel
                icon={Users}
                title={`No ${noun} here yet`}
                body="Be the first to bring people together."
                action={
                  <button
                    type="button"
                    onClick={() => navigate(createPath)}
                    className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-200"
                  >
                    {clubsOnly ? 'Create Club' : 'Create Community'}
                  </button>
                }
              />
            ) : isSearchingOrFiltering ? (
              <section>
                <SectionTitle count={resultsLoading ? undefined : popularCommunities.length}>
                  {searchTerm.trim()
                    ? `Results for “${searchTerm.trim()}”`
                    : TYPE_FILTERS.find((f) => f.id === typeFilter)?.label}
                </SectionTitle>
                {resultsLoading ? (
                  <div className="space-y-2.5" aria-busy="true">
                    <CardSkeleton />
                    <CardSkeleton />
                  </div>
                ) : popularCommunities.length === 0 ? (
                  <StatePanel icon={Search} title={`No ${noun} found`} body="Try a different name or category." />
                ) : (
                  renderCards(popularCommunities)
                )}
              </section>
            ) : (
              <div className="space-y-6">
                {yourCommunities.length > 0 && (
                  <section>
                    <SectionTitle count={yourCommunities.length}>{clubsOnly ? 'Your clubs' : 'Your communities'}</SectionTitle>
                    <div className="-mx-4 px-4 flex gap-3 overflow-x-auto scroll-hidden pb-1">
                      {yourCommunities.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openCommunity(c)}
                          className="w-[76px] flex-shrink-0 flex flex-col items-center text-center active:scale-95 transition-transform duration-150"
                        >
                          <span className="relative w-16 h-16 rounded-2xl overflow-hidden bg-blue-600 flex items-center justify-center ring-1 ring-black/5">
                            {c.icon || c.coverImage ? (
                              <img src={c.icon || c.coverImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white text-lg font-bold">{getInitials(c.name)}</span>
                            )}
                          </span>
                          <span className="mt-1.5 w-full text-[11px] font-semibold text-gray-900 leading-tight line-clamp-2">{c.name}</span>
                          {membershipStates.get(c.id) === 'owner' && (
                            <span className="text-[10px] font-medium text-blue-600">Owner</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {filteredCampusCommunities.length > 0 && (
                  <section>
                    <SectionTitle>{clubsOnly ? 'Clubs at your campus' : 'For your campus'}</SectionTitle>
                    {renderCards(filteredCampusCommunities)}
                  </section>
                )}

                {/* Skipped when everything left to discover is already
                    listed under "For your campus" above. */}
                {(popularCommunities.length > 0 || filteredCampusCommunities.length === 0) && (
                <section>
                  <SectionTitle count={popularCommunities.length || undefined}>
                    {yourCommunities.length > 0 || filteredCampusCommunities.length > 0 ? `Popular ${noun}` : `Discover ${noun}`}
                  </SectionTitle>
                  {popularCommunities.length === 0 ? (
                    <StatePanel
                      icon={Sparkles}
                      title={`You're all caught up`}
                      body={`You've joined every popular ${clubsOnly ? 'club' : 'community'}. Check back soon, or start your own.`}
                      action={
                        <button
                          type="button"
                          onClick={() => navigate(createPath)}
                          className="mt-4 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-200"
                        >
                          {clubsOnly ? 'Create Club' : 'Create Community'}
                        </button>
                      }
                    />
                  ) : (
                    renderCards(popularCommunities)
                  )}
                </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right rail (desktop) */}
      <aside className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 h-screen sticky top-0 overflow-y-auto px-4 py-5 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-500" /> Quick Stats
          </p>
          <div className="grid grid-cols-3 gap-2">
            {quickStats.map(({ key, icon: Icon, value, label, tint }) => (
              <div key={key} className="min-w-0 rounded-xl bg-gray-50/70 dark:bg-white/5 px-2 py-3 text-center">
                <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center ${tint}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <p className="mt-1.5 text-base font-bold text-gray-900 leading-none">{value}</p>
                <p className="mt-1 text-[10px] text-gray-400 leading-tight break-words">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {trendingCommunities.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-500" /> {clubsOnly ? 'Trending Clubs' : 'Trending on Campus'}
            </p>
            <div className="space-y-1.5">
              {trendingCommunities.map((community, i) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => openCommunity(community)}
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
            <Sparkles className="w-4 h-4" /> {clubsOnly ? 'Start your own club' : 'Start your own community'}
          </p>
          <p className="relative mt-1.5 text-xs text-blue-100 leading-relaxed">
            Have a club, project or campus idea? Bring people together.
          </p>
          <button
            type="button"
            onClick={() => navigate(createPath)}
            className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 active:scale-[0.98] transition-all duration-200"
          >
            {clubsOnly ? 'Create Club →' : 'Create Community →'}
          </button>
        </div>
      </aside>
    </div>
  )
}
