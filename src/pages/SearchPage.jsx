import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Clock, Compass, Flame, PackageSearch, PenSquare, Search as SearchIcon, ShoppingBag, Sparkles, UserRound, Users, X, Zap } from 'lucide-react'
import StudentCard from '../components/StudentCard.jsx'
import CollegeResultCard from '../components/CollegeResultCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import PostCard from '../components/PostCard.jsx'
import SearchSkeleton from '../components/SearchSkeleton.jsx'
import SearchEmptyState from '../components/SearchEmptyState.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getFeedPosts } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { searchAll, getPeopleFromMyCourse } from '../firebase/searchService.js'
import { searchCommunitiesByName, getTrendingCommunities } from '../firebase/communityService.js'
import { searchPostsByText, searchPostsByHashtag } from '../firebase/postService.js'
import { searchLostFoundItems } from '../firebase/lostFoundService.js'
import { auth } from '../firebase/firebase.js'
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from '../utils/recentSearches.js'
import { useAuth } from '../context/AuthContext.jsx'

const tabs = [
  { label: 'All', key: 'all' },
  { label: 'Students', key: 'students' },
  { label: 'Colleges', key: 'colleges' },
  { label: 'Communities', key: 'communities' },
  { label: 'Posts', key: 'posts' },
  { label: 'Notes', key: 'notes' },
  { label: 'Lost & Found', key: 'lostfound' }
]

// Discovery-hub category shortcuts (the "not searching yet" state) —
// distinct from `tabs` above, which filters real search RESULTS once
// a query exists. "Events" is deliberately not included here: no real
// events-browse feature exists in this app (only a single-event
// ComingSoon placeholder), and a pill with nowhere real to go is
// exactly the "dead button" this task explicitly forbids.
const DISCOVER_CATEGORIES = [
  { key: 'all', label: 'All', icon: Compass },
  { key: 'people', label: 'People', icon: UserRound },
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [recent, setRecent] = useState([])

  // #hashtag deep link (MentionText's hashtag click, notification
  // deep-links, etc.) — a dedicated view, not folded into the normal
  // debounced-query search below, since it's a different query shape
  // (array-contains on a stored hashtags field, not a text prefix
  // range) with its own loading/empty/error states.
  const activeTag = searchParams.get('tag') || ''
  const [tagResults, setTagResults] = useState([])
  const [tagStatus, setTagStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'

  useEffect(() => {
    if (!activeTag) {
      setTagResults([])
      setTagStatus('idle')
      return undefined
    }
    let cancelled = false
    setTagStatus('loading')
    searchPostsByHashtag(activeTag, auth.currentUser?.uid)
      .then((results) => {
        if (!cancelled) {
          setTagResults(results)
          setTagStatus('success')
        }
      })
      .catch(() => {
        if (!cancelled) setTagStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [activeTag])

  const [students, setStudents] = useState([])
  const [colleges, setColleges] = useState([])
  const [communities, setCommunities] = useState([])
  const [posts, setPosts] = useState([])
  const [lostFoundItems, setLostFoundItems] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'

  // Notes aren't a separate collection — NotesView.jsx already treats
  // "a post with a document attached" as the definition of a note, so
  // this is a derived filter over the SAME posts search results above,
  // not a second search call or a duplicated data source.
  const noteResults = posts.filter((post) => post.file)

  const [popularCommunities, setPopularCommunities] = useState([])
  const [latestPosts, setLatestPosts] = useState([])
  const [latestPostsLoading, setLatestPostsLoading] = useState(true)
  const [discoverCategory, setDiscoverCategory] = useState('all')
  const [coursemates, setCoursemates] = useState([])
  const { profile } = useAuth()

  // "People from your course" — real, server-side, exact-match query
  // (getPeopleFromMyCourse, new), only fires once profile.collegeId/
  // .course are actually loaded. Shown in the discovery hub (empty
  // query state) only — never touches the typed-search results below.
  useEffect(() => {
    if (!profile?.collegeId || !profile?.course) {
      setCoursemates([])
      return
    }
    let cancelled = false
    getPeopleFromMyCourse(profile.collegeId, profile.course, { excludeUid: auth.currentUser?.uid })
      .then((data) => {
        if (!cancelled) setCoursemates(data)
      })
      .catch(() => {
        if (!cancelled) setCoursemates([])
      })
    return () => {
      cancelled = true
    }
  }, [profile?.collegeId, profile?.course])

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
      setLostFoundItems([])
      return undefined
    }

    setStatus('loading')
    const requestId = requestIdRef.current

    const timer = window.setTimeout(async () => {
      try {
        const [result, communityResults, postResults, lostFoundResults] = await Promise.all([
          searchAll(trimmed),
          searchCommunitiesByName(trimmed).catch(() => []),
          searchPostsByText(trimmed, auth.currentUser?.uid).catch(() => []),
          searchLostFoundItems(trimmed).catch(() => [])
        ])
        if (requestIdRef.current !== requestId) return // a newer keystroke superseded this search
        setStudents(result.students)
        setColleges(result.colleges)
        setCommunities(communityResults)
        setPosts(postResults)
        setLostFoundItems(lostFoundResults)
        setStatus('success')
      } catch {
        if (requestIdRef.current !== requestId) return
        setStatus('error')
      }
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  const isSearching = query.trim().length > 0
  const hasResults =
    students.length > 0 || colleges.length > 0 || communities.length > 0 || posts.length > 0 || lostFoundItems.length > 0

  const showStudents = activeTab === 'all' || activeTab === 'students'
  const showColleges = activeTab === 'all' || activeTab === 'colleges'
  const showCommunities = activeTab === 'all' || activeTab === 'communities'
  const showPosts = activeTab === 'all' || activeTab === 'posts'
  const showNotes = activeTab === 'notes'
  const showLostFound = activeTab === 'all' || activeTab === 'lostfound'

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
      searchPostsByText(query.trim(), auth.currentUser?.uid).catch(() => []),
      searchLostFoundItems(query.trim()).catch(() => [])
    ])
      .then(([result, communityResults, postResults, lostFoundResults]) => {
        if (requestIdRef.current !== requestId) return
        setStudents(result.students)
        setColleges(result.colleges)
        setCommunities(communityResults)
        setPosts(postResults)
        setLostFoundItems(lostFoundResults)
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

  const showPeopleSection = discoverCategory === 'all' || discoverCategory === 'people'
  const showCommunitiesSection = discoverCategory === 'all' || discoverCategory === 'communities'
  const showLatestPostsSection = discoverCategory === 'all' || discoverCategory === 'posts'

  // #hashtag deep-link mode — a fully separate, self-contained render
  // path (not woven into the tab/discovery JSX below) so the existing
  // query-based search experience is byte-for-byte unchanged; this only
  // ever renders when arriving via a hashtag click/deep-link (?tag=).
  if (activeTag) {
    return (
      <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        <div className="mx-auto max-w-[480px] lg:max-w-[680px] px-4 lg:px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">#{activeTag}</h1>
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {tagStatus === 'loading' ? (
            <div className="py-16 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : tagStatus === 'error' ? (
            <p className="py-16 text-center text-sm text-gray-400">Couldn't load posts for this tag.</p>
          ) : tagResults.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No posts tagged #{activeTag} yet.</p>
          ) : (
            tagResults.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        <div className="lg:px-6 lg:py-4 lg:max-w-[900px] lg:mx-auto">
          <div className="mx-auto max-w-[480px] lg:mx-0 lg:max-w-none bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
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

                  {showPeopleSection && coursemates.length > 0 && (
                    <section className="px-4 lg:px-6 pt-2 pb-3">
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <UserRound className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-50">People from your course</p>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                        {profile.course}
                        {profile.year ? ` · ${profile.year}` : ''} at your campus.
                      </p>
                      <div className="space-y-1">
                        {coursemates.map((student) => (
                          <StudentCard key={student.uid} student={student} />
                        ))}
                      </div>
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

                  {recent.length === 0 && coursemates.length === 0 && popularCommunities.length === 0 && latestPosts.length === 0 && !latestPostsLoading && (
                    <div className="px-6 py-16 text-center">
                      <p className="text-sm text-gray-400 dark:text-gray-500">Search for students, colleges or communities to get started.</p>
                    </div>
                  )}

                  {/* Folded in from the old detached right sidebar — same 4
                      real destinations (no dead buttons, no fabricated
                      content), now part of the main discovery flow instead
                      of a separate column that left a giant empty gap on
                      any viewport narrower than ~1280px. */}
                  <section className="px-4 lg:px-6 pt-2 pb-4">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Zap className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Quick Actions</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { label: 'Create Post', to: '/create', icon: PenSquare },
                        { label: 'Browse Communities', to: '/communities', icon: Users },
                        { label: 'Marketplace', to: '/marketplace', icon: ShoppingBag },
                        { label: 'Lost & Found', to: '/lost-found', icon: PackageSearch }
                      ].map((action) => (
                        <button
                          key={action.to}
                          type="button"
                          onClick={() => navigate(action.to)}
                          className="flex flex-col items-start gap-2 rounded-2xl border border-gray-100 dark:border-white/10 p-3.5 text-left hover:border-gray-200 dark:hover:border-white/20 hover:shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-all duration-200"
                        >
                          <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                            <action.icon className="w-4 h-4" />
                          </span>
                          <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
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

                  {showNotes && (
                    noteResults.length > 0 ? (
                      <section>
                        {noteResults.map((post) => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </section>
                    ) : (
                      <p className="px-4 lg:px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        No notes matched "{query.trim()}".
                      </p>
                    )
                  )}

                  {showLostFound && lostFoundItems.length > 0 && (
                    <section className="px-4 lg:px-6">
                      {activeTab === 'all' && (
                        <p className="pt-3 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Lost &amp; Found
                        </p>
                      )}
                      <div className="space-y-2 pb-3">
                        {lostFoundItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigate(`/lost-found?item=${item.id}`)}
                            className="w-full flex items-center gap-3 text-left rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#151721] p-2.5 hover:border-gray-200 dark:hover:border-white/20 transition-all duration-200"
                          >
                            <div className="w-11 h-11 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/10 flex-shrink-0 flex items-center justify-center">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <PackageSearch className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 truncate">{item.title}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                {item.type === 'lost' ? 'Lost' : 'Found'} · {item.location || item.category}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
    </div>
  )
}
