import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, TrendingUp, X } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import SearchResultCard from '../components/SearchResultCard.jsx'
import { students, clubs, events, notes, recentSearches, trendingSearches } from '../data/dummySearch.js'

const tabs = [
  { label: 'All', key: 'all' },
  { label: 'Students', key: 'student' },
  { label: 'Notes', key: 'notes' },
  { label: 'Events', key: 'event' },
  { label: 'Clubs', key: 'club' }
]

const allResults = [...students, ...clubs, ...events, ...notes]

function resultHaystack(result) {
  return [
    result.name,
    result.title,
    result.department,
    result.college,
    result.category,
    result.subject,
    result.org,
    result.uploader
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export default function SearchPage() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [recent, setRecent] = useState(recentSearches)

  const filteredResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []
    const matched = allResults.filter((result) => resultHaystack(result).includes(trimmed))
    return activeTab === 'all' ? matched : matched.filter((result) => result.type === activeTab)
  }, [query, activeTab])

  const isSearching = query.trim().length > 0

  const runSearch = (value) => {
    setQuery(value)
    inputRef.current?.focus()
  }

  const removeRecent = (value) => {
    setRecent((prev) => prev.filter((item) => item !== value))
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
                placeholder="Search students, notes, events, clubs"
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
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
                      onClick={() => setRecent([])}
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

              <section className="px-4 py-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trending</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trendingSearches.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => runSearch(item)}
                      className="rounded-full bg-blue-50 text-blue-600 text-xs font-medium px-3.5 py-1.5 hover:bg-blue-100 transition-all duration-300"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {isSearching && filteredResults.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">No results for "{query}".</p>
            </div>
          )}

          {isSearching && filteredResults.length > 0 && (
            <div className="pt-1">
              {filteredResults.map((result) => (
                <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}