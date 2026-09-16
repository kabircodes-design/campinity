import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Compass, Flame, PackageSearch, PenSquare, Search as SearchIcon, ShoppingBag, Sparkles, Users, X, Zap } from 'lucide-react'
import StudentCard from '../components/StudentCard.jsx'
import CollegeResultCard from '../components/CollegeResultCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import PostCard from '../components/PostCard.jsx'
import SearchSkeleton from '../components/SearchSkeleton.jsx'
import SearchEmptyState from '../components/SearchEmptyState.jsx'
import Avatar from '../components/Avatar.jsx'
import { getAvatarColor, getInitials, getFeedPosts } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { searchAll } from '../firebase/searchService.js'
import { searchCommunitiesByName, getTrendingCommunities } from '../firebase/communityService.js'
import { searchPostsByText } from '../firebase/postService.js'
import { auth } from '../firebase/firebase.js'
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from '../utils/recentSearches.js'

const tabs = [
  { label: 'All', key: 'all' },
  { label: 'Students', key: 'students' },
  { label: 'Colleges', key: 'colleges' },
  { label: 'Communities', key: 'communities' },
  { label: 'Posts', key: 'posts' }
]

// Discovery-hub category shortcuts (the "not searching yet" state) —
// distinct from `tabs` above, which filters real search RESULTS once
// a query exists. "Events" is deliberately not included here: no real
// events-browse feature exists in this app (only a single-event
// ComingSoon placeholder), and a pill with nowhere real to go is
// exactly the "dead button" this task explicitly forbids.
const DISCOVER_CATEGORIES = [
  { key: 'all', label: 'All', icon: Compass },
  { key: 'communities', label: 'Communities', icon: Users },
  { key: 'posts', label: 'Posts', icon: PenSquare },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, to: '/marketplace' },
  { key: 'lost-found', label: 'Lost & Found', icon: PackageSearch, to: '/lost-found' }
]

const DEBOUNCE_MS = 300

/**
 * Redesign pass — the previous version was purely search-first: an
 * empty query showed only Recent searches + a small trending-communities
 * grid, nothing resembling a real discovery hub. This adds that layer
 * (hero, category shortcuts, Trending Communities, Latest Posts, a
 * richer right rail) ONLY for the "not currently searching" state —
 * every existing search behavior below (debounced query, tabs,
 * students/colleges/communities/posts results, recent-search history,
 * loading/error/empty states) is completely untouched, still the same
 * functions, same components, same logic.
 *
 * Glassmorphism removal: this page had the exact same
 * ambient-glow-layer + #f3f0fb background + bg-white/40 backdrop-blur-2xl
 * treatment ProfilePage.jsx had before its own redesign pass — same
 * root cause, same fix: plain white/gray-50 matching Home/Communities,
 * confirmed neither uses backdrop-blur anywhere.
 *
 * "Latest Posts" reuses getFeedPosts (the exact same broad, public,
 * newest-first query Home's own Campus feed already uses) — a fresh,
 * small page (6), not a duplicated feed system. "Trending Now" and
 * "Popular" in the right rail reuse the SAME trending-communities data
 * the center column already fetches (no tag-analytics collection
 * exists anywhere in this app, and inventing one wasn't in scope) —
 * real signal, not fabricated engagement numbers.
 */
export default function SearchPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const requestIdRef = useRef(0)

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [recent, setRecent] = useState([])

  const [students, setStudents] = useState([])
  const [colleges, setColleges] = useState([])
  const [communities, setCommunities] = useState([])
  const [posts, setPosts] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'

  const [popularCommunities, setPopularCommunities] = useState([])
  const [latestPosts, setLatestPosts] = useState([])
  const [latestPostsLoading, setLatestPostsLoading] = useState(true)
  const [discoverCategory, setDiscoverCategory] = useState('all')

  useEffect(() => {
    getTrendingCommunities({ pageSize: 5 }).then(setPopularCommunities).catch(() => {})
  }, [])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    getFeedPosts(uid, 6)
      .then(setLatestPosts)
      .catch(() => {})
      .finally(() => setLatestPostsLoading(false))
  }, [])

  useEffect(() => {
    setRecent(getRecentSearches())
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    requestIdRef.current += 1

    if (!trimmed) {
      setStatus('idle')
      setStudents([])
      setColleges([])
      setCommunities([])
      setPosts([])
      return undefined
    }

    setStatus('loading')
    const requestId = requestIdRef.current

    const timer = window.setTimeout(async () => {
      try {
        const [result, communityResults, postResults] = await Promise.all([
          searchAll(trimmed),
          searchCommunitiesByName(trimmed).catch(() => []),
          searchPostsByText(trimmed, auth.currentUser?.uid).catch(() => [])
        ])
        if (requestIdRef.current !== requestId) return // a newer keystroke superseded this search
        setStudents(result.students)
        setColleges(result.colleges)
        setCommunities(communityResults)
        setPosts(postResults)
        setStatus('success')
      } catch {
        if (requestIdRef.current !== requestId) return
        setStatus('error')
      }
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  const isSearching = query.trim().length > 0
  const hasResults = students.length > 0 || colleges.length > 0 || communities.length > 0 || posts.length > 0

  const showStudents = activeTab === 'all' || activeTab === 'students'
  const showColleges = activeTab === 'all' || activeTab === 'colleges'
  const showCommunities = activeTab === 'all' || activeTab === 'communities'
  const showPosts = activeTab === 'all' || activeTab === 'posts'

  const runSearch = (value) => {
    setQuery(value)
    inputRef.current?.focus()
  }

  const commitSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    setRecent(addRecentSearch(trimmed))
  }

  const removeRecent = (value) => {
    setRecent(removeRecentSearch(value))
  }

  const retry = () => {
    setStatus('loading')
    requestIdRef.current += 1
    const requestId = requestIdRef.current
    Promise.all([
      searchAll(query.trim()),
      searchCommunitiesByName(query.trim()).catch(() => []),
      searchPostsByText(query.trim(), auth.currentUser?.uid).catch(() => [])
    ])
      .then(([result, communityResults, postResults]) => {
        if (requestIdRef.current !== requestId) return
        setStudents(result.students)
        setColleges(result.colleges)
        setCommunities(communityResults)
        setPosts(postResults)
        setStatus('success')
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return
        setStatus('error')
      })
  }

  const handleDiscoverCategory = (category) => {
    if (category.to) {
      navigate(category.to)
      return
    }
    setDiscoverCategory(category.key)
  }

  const showCommunitiesSection = discoverCategory === 'all' || discoverCategory === 'communities'
  const showLatestPostsSection = discoverCategory === 'all' || discoverCategory === 'posts'

  return (
    <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        <div className="lg:flex lg:items-start lg:gap-5 lg:px-6 lg:py-4 lg:max-w-[1280px] lg:mx-auto">
          <div className="mx-auto max-w-[480px] lg:mx-0 lg:max-w-[740px] lg:flex-1 lg:min-w-0 bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
            {/* Mobile header — search input only. AppShell's own persistent
                header already provides the way back to Home on mobile
                (the Logo button) — a second "back" button here would be
                redundant/confusing now that Explore is a peer shell tab,
                not a page you drilled into. Desktop gets the hero below instead. */}
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:hidden">
              <div className="h-14 flex items-center gap-2 px-3">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onBlur={commitSearch}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitSearch()
                    }}
                    placeholder="Search students, communities, posts..."
                    className="w-full rounded-full border border-gray-200 bg-gray-50 pl-4 pr-9 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-50 dark:placeholder:text-gray-500 dark:focus:bg-white/10 dark:focus:ring-blue-500/15 transition-all duration-300"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 transition-all duration-300"
                    >
                      <X className="w-3 h-3" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>

              {isSearching && (
                <div className="flex items-center overflow-x-auto scroll-hidden px-3 pb-2 gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
                        activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </header>

            {!isSearching && (
              <section className="px-4 lg:px-6 pt-4 lg:pt-6">
                <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl px-5 py-6 lg:px-8 lg:py-8 bg-gradient-to-br from-[#eaf3ff] via-[#dcecff] to-[#e7f7f7] dark:from-[#141a2e] dark:via-[#121629] dark:to-[#101f21]">
                  <div
                    className="absolute -top-10 -right-6 w-48 h-48 rounded-full opacity-60 dark:opacity-25 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute -bottom-14 right-10 w-40 h-40 rounded-full opacity-50 dark:opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)' }}
                    aria-hidden="true"
                  />
                  <div className="hidden lg:flex absolute right-8 top-1/2 -translate-y-1/2 w-28 h-28 rounded-3xl bg-white/70 dark:bg-white/10 border border-white dark:border-white/10 items-center justify-center shadow-sm dark:shadow-none">
                    <Sparkles className="w-10 h-10 text-blue-500 dark:text-blue-400" strokeWidth={1.5} />
                  </div>
                  <p className="relative text-[11px] font-bold tracking-wide text-blue-700/70 dark:text-blue-300/80 uppercase">Explore Campinity</p>
                  <h1 className="relative mt-1 text-2xl lg:text-[28px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-tight max-w-sm">
                    Discover what's happening in your campus!
                  </h1>
                  <p className="relative mt-1.5 text-[13px] lg:text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                    Find communities, posts, and people that match your interests.
                  </p>

                  <div className="relative mt-5 max-w-md">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onBlur={commitSearch}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitSearch()
                      }}
                      placeholder="Search Campinity..."
                      className="w-full rounded-2xl border border-gray-200 bg-white/90 pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-gray-50 dark:placeholder:text-gray-500 dark:focus:bg-white/15 dark:focus:ring-blue-500/15 dark:shadow-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 overflow-x-auto scroll-hidden pb-1">
                  {DISCOVER_CATEGORIES.map((category) => {
                    const Icon = category.icon
                    const active = !category.to && discoverCategory === category.key
                    return (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => handleDiscoverCategory(category)}
                        className={`flex-shrink-0 flex items-center gap-1.5 rounded-full text-xs font-semibold px-4 py-2 transition-all duration-300 ${
                          active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {category.label}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Desktop tabs, shown only once actively searching (mobile's are in the sticky header above). */}
            {isSearching && (
              <div className="hidden lg:block px-6 pt-6">
                <div className="relative">
                  <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onBlur={commitSearch}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitSearch()
                    }}
                    placeholder="Search Campinity..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-50 dark:placeholder:text-gray-500 dark:focus:bg-white/10 dark:focus:ring-blue-500/15 dark:shadow-none transition-all duration-300"
                  />
                  {query && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/20 transition-all duration-300"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`rounded-full text-xs font-semibold px-4 py-2 transition-all duration-300 ${
                        activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <main className="pb-24">
              {!isSearching && (
                <div className="pt-4">
                  {recent.length > 0 && (
                    <section className="px-4 lg:px-6 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recent</p>
                        <button
                          type="button"
                          onClick={() => setRecent(clearRecentSearches())}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-all duration-300"
                        >
                          Clear all
                        </button>
                      </div>
                      <ul className="space-y-1">
                        {recent.map((item) => (
                          <li key={item} className="flex items-center gap-3 group">
                            <button
                              type="button"
                              onClick={() => runSearch(item)}
                              className="flex-1 flex items-center gap-3 py-2 text-left"
                            >
                              <Clock className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${item}`}
                              onClick={() => removeRecent(item)}
                              className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {showCommunitiesSection && popularCommunities.length > 0 && (
                    <section className="px-4 lg:px-6 pt-2 pb-3">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Trending Communities</p>
                        </div>
                        <button type="button" onClick={() => navigate('/communities')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                          View all
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Join active communities and be part of something bigger.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {popularCommunities.map((community) => (
                          <CommunityCard key={community.id} community={community} />
                        ))}
                      </div>
                    </section>
                  )}

                  {showLatestPostsSection && (
                    <section className="pt-2">
                      <div className="flex items-center justify-between px-4 lg:px-6 mb-1">
                        <div className="flex items-center gap-1.5">
                          <PenSquare className="w-4 h-4 text-blue-600" />
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Latest Posts</p>
                        </div>
                      </div>
                      <p className="px-4 lg:px-6 text-xs text-gray-400 dark:text-gray-500 mb-2">Fresh conversations from your campus community.</p>
                      {latestPostsLoading ? (
                        <div className="px-4 lg:px-6 space-y-3">
                          {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-white/10 animate-pulse" />
                          ))}
                        </div>
                      ) : latestPosts.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No posts yet — be the first to share something.</p>
                      ) : (
                        latestPosts.map((post) => <PostCard key={post.id} post={post} />)
                      )}
                    </section>
                  )}

                  {recent.length === 0 && popularCommunities.length === 0 && latestPosts.length === 0 && !latestPostsLoading && (
                    <div className="px-6 py-16 text-center">
                      <p className="text-sm text-gray-400 dark:text-gray-500">Search for students, colleges or communities to get started.</p>
                    </div>
                  )}
                </div>
              )}

              {isSearching && status === 'loading' && (
                <div className="pt-1">
                  <SearchSkeleton />
                </div>
              )}

              {isSearching && status === 'error' && (
                <div className="px-6 py-16 text-center">
                  <p className="text-sm text-gray-900 dark:text-gray-50 font-semibold">Something went wrong</p>
                  <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Could not complete the search.</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                  >
                    Try again
                  </button>
                </div>
              )}

              {isSearching && status === 'success' && !hasResults && (
                <SearchEmptyState
                  query={query.trim()}
                  suggestions={popularCommunities.map((c) => c.name).filter(Boolean)}
                  onSuggestionClick={runSearch}
                />
              )}

              {isSearching && status === 'success' && hasResults && (
                <div className="pt-1">
                  {showStudents && students.length > 0 && (
                    <section>
                      {activeTab === 'all' && (
                        <p className="px-4 lg:px-6 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Students
                        </p>
                      )}
                      {students.map((student) => (
                        <StudentCard key={student.uid} student={student} />
                      ))}
                    </section>
                  )}

                  {showColleges && colleges.length > 0 && (
                    <section>
                      {activeTab === 'all' && (
                        <p className="px-4 lg:px-6 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Colleges
                        </p>
                      )}
                      {colleges.map((college) => (
                        <CollegeResultCard key={college.id} college={college} />
                      ))}
                    </section>
                  )}

                  {showCommunities && communities.length > 0 && (
                    <section className="px-4 lg:px-6">
                      {activeTab === 'all' && (
                        <p className="pt-3 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Communities
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3">
                        {communities.map((community) => (
                          <CommunityCard key={community.id} community={community} />
                        ))}
                      </div>
                    </section>
                  )}

                  {showPosts && posts.length > 0 && (
                    <section>
                      {activeTab === 'all' && (
                        <p className="px-4 lg:px-6 pt-3 pb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Posts
                        </p>
                      )}
                      {posts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                    </section>
                  )}
                </div>
              )}
            </main>
          </div>

          <aside className="hidden lg:flex lg:flex-col w-[300px] flex-shrink-0 gap-4 py-4">
            {popularCommunities.length > 0 && (
              <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Trending Now</p>
                </div>
                <div className="space-y-3">
                  {popularCommunities.slice(0, 5).map((community, index) => (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => navigate(`/community/${community.id}`)}
                      className="w-full flex items-center gap-2.5 text-left group"
                    >
                      <span className="w-5 flex-shrink-0 text-sm font-bold text-gray-300 dark:text-gray-600">{index + 1}</span>
                      <Avatar
                        initials={getInitials(community.name)}
                        colorClass={getAvatarColor(community.id)}
                        size="sm"
                        src={community.icon || undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                          {community.name}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{community.membersCount} members</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Quick Actions</p>
              </div>
              <div className="space-y-1">
                {[
                  { label: 'Create Post', to: '/create', icon: PenSquare },
                  { label: 'Browse Communities', to: '/communities', icon: Users },
                  { label: 'Explore Marketplace', to: '/marketplace', icon: ShoppingBag },
                  { label: 'Lost & Found', to: '/lost-found', icon: PackageSearch }
                ].map((action) => (
                  <button
                    key={action.to}
                    type="button"
                    onClick={() => navigate(action.to)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200 text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <action.icon className="w-4 h-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">{action.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)' }}>
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
              <Sparkles className="w-5 h-5 text-white/90" />
              <p className="mt-2 text-sm font-bold text-white">Make the most of Campinity!</p>
              <p className="mt-1 text-[12.5px] text-blue-100 leading-relaxed">
                Discover communities, posts and people around your campus.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.focus()}
                className="mt-3 flex items-center gap-1.5 rounded-full bg-white text-blue-600 text-xs font-bold px-4 py-2 hover:bg-blue-50 transition-all duration-200"
              >
                Start Exploring
              </button>
            </section>
          </aside>
        </div>
    </div>
  )
}
