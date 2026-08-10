import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Search, Users } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import SwipeablePage from '../components/SwipeablePage.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getTrendingCommunities, getUserCommunityMemberships, getUserPendingRequests, searchCommunitiesByName } from '../firebase/communityService.js'

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

export default function DiscoverCommunitiesPage() {
  const navigate = useNavigate()
  const [communities, setCommunities] = useState([])
  const [membershipStates, setMembershipStates] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    Promise.all([
      getTrendingCommunities({ pageSize: 40 }),
      uid ? getUserCommunityMemberships(uid).catch(() => []) : Promise.resolve([]),
      uid ? getUserPendingRequests(uid).catch(() => []) : Promise.resolve([])
    ]).then(([communitiesData, memberships, pendingRequests]) => {
      if (cancelled) return
      setCommunities(communitiesData)
      const states = new Map()
      memberships.forEach((m) => states.set(m.communityId, m.role === 'owner' ? 'owner' : 'member'))
      pendingRequests.forEach((r) => {
        if (!states.has(r.communityId)) states.set(r.communityId, 'pending')
      })
      setMembershipStates(states)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

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
    const base = searchResults !== null ? searchResults : communities
    return typeFilter === 'all' ? base : base.filter((c) => c.type === typeFilter)
  }, [communities, searchResults, typeFilter])

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

  const isSearchingOrFiltering = searchTerm.trim() || typeFilter !== 'all'

  return (
    <>
      <SwipeablePage>
        <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
          <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-24">
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
              <div className="h-14 flex items-center justify-between px-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Back"
                    onClick={() => navigate(-1)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <span className="text-base font-bold tracking-tight text-gray-900">Communities</span>
                </div>
                <button
                  type="button"
                  aria-label="Create a community"
                  onClick={() => navigate('/community/create')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all duration-300"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <p className="px-4 pb-2.5 text-xs text-gray-400">Find your people. Join the conversation.</p>
            </header>

            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search communities"
                  aria-label="Search communities"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
                />
              </div>

              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scroll-hidden pb-0.5">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTypeFilter(f.id)}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      typeFilter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <main className="px-4 py-4">
              {loading ? (
                <div className="py-16 flex justify-center">
                  <Loader size="md" tone="dark" />
                </div>
              ) : communities.length === 0 && !searchTerm ? (
                <div className="py-16 text-center">
                  <div className="mx-auto w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center">
                    <Users className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">No communities yet</p>
                  <p className="mt-1 text-sm text-gray-400">Be the first to create a space for your campus.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/community/create')}
                    className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                  >
                    Create Community
                  </button>
                </div>
              ) : (
                <>
                  {!isSearchingOrFiltering && yourCommunities.length > 0 && (
                    <div className="mb-5">
                      <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Communities</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {yourCommunities.map((community) => (
                          <CommunityCard key={community.id} community={community} membershipState={membershipStates.get(community.id)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {searching ? (
                    <div className="py-10 flex justify-center">
                      <Loader size="sm" tone="dark" />
                    </div>
                  ) : discoverCommunities.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">
                      {isSearchingOrFiltering ? 'No communities found.' : 'No more communities to discover.'}
                    </p>
                  ) : (
                    <div>
                      {!isSearchingOrFiltering && (
                        <p className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          {yourCommunities.length > 0 ? 'Popular on Campus' : 'Discover Communities'}
                        </p>
                      )}
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
            </main>
          </div>
        </div>
      </SwipeablePage>

      <BottomNav />
    </>
  )
}
