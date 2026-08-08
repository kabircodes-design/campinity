import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, X } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import StudentCard from '../components/StudentCard.jsx'
import CollegeResultCard from '../components/CollegeResultCard.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import PostCard from '../components/PostCard.jsx'
import SearchSkeleton from '../components/SearchSkeleton.jsx'
import SearchEmptyState from '../components/SearchEmptyState.jsx'
import { searchAll } from '../firebase/searchService.js'
import { searchCommunitiesByName } from '../firebase/communityService.js'
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

const DEBOUNCE_MS = 300

/**
 * Extended across two passes now. Communities were added first
 * (searchCommunitiesByName, run in parallel with the untouched
 * searchAll()). This pass adds Posts — searchPostsByText, new in
 * postService.js, using a real Firestore prefix-range query on a
 * textLower field written at post-creation time (added this pass).
 * Posts created before textLower existed are not searchable — a
 * real, stated limitation, not a bug being silently introduced.
 * searchAll() itself remains completely untouched throughout.
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

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        {/* -------------------------------------------------------- */}
        {/* Header — back button + search input                      */}
        {/* -------------------------------------------------------- */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/home')}
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="relative flex-1">
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={commitSearch}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitSearch()
                }}
                placeholder="Search students, communities, posts..."
                className="w-full rounded-full border border-gray-200 bg-gray-50 pl-4 pr-9 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-300 transition-all duration-300"
                >
                  <X className="w-3 h-3" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center overflow-x-auto scroll-hidden px-3 pb-2 gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
                  activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* -------------------------------------------------------- */}
        {/* Body                                                      */}
        {/* -------------------------------------------------------- */}
        <main className="pb-24">
          {!isSearching && (
            <div className="pt-2">
              {recent.length > 0 && (
                <section className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent</p>
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
                          <Clock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${item}`}
                          onClick={() => removeRecent(item)}
                          className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all duration-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {recent.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <p className="text-sm text-gray-400">Search for students, colleges or communities to get started.</p>
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
              <p className="text-sm text-gray-900 font-semibold">Something went wrong</p>
              <p className="mt-1 text-sm text-gray-400">Could not complete the search.</p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
              >
                Try again
              </button>
            </div>
          )}

          {isSearching && status === 'success' && !hasResults && <SearchEmptyState query={query.trim()} />}

          {isSearching && status === 'success' && hasResults && (
            <div className="pt-1">
              {showStudents && students.length > 0 && (
                <section>
                  {activeTab === 'all' && (
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Colleges
                    </p>
                  )}
                  {colleges.map((college) => (
                    <CollegeResultCard key={college.id} college={college} />
                  ))}
                </section>
              )}

              {showCommunities && communities.length > 0 && (
                <section className="px-4">
                  {activeTab === 'all' && (
                    <p className="pt-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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

      <BottomNav />
    </div>
  )
}
