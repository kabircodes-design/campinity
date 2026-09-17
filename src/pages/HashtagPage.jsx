import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Hash } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import PostCard from '../components/PostCard.jsx'
import { auth } from '../firebase/firebase.js'
import { getHashtagPostCount, searchPostsByHashtag } from '../firebase/postService.js'
import { normalizeHashtag } from '../utils/hashtags.js'

const TABS = ['Top', 'Recent']
const PAGE_SIZE = 50

/**
 * Dedicated hashtag discovery page (Part 15/16) — replaces the old
 * /search?tag= deep-link as the real click target for every #hashtag
 * in the app (MentionText.jsx). Reuses the EXACT existing query
 * (searchPostsByHashtag, already a real `hashtags array-contains`
 * indexed query, no client-side full-collection filtering) and the
 * existing PostCard, not a second post-rendering implementation.
 *
 * Top vs Recent: both come from the same one bounded fetch (PAGE_SIZE),
 * not two separate queries — Recent is that fetch as-is (the query's
 * own createdAt-desc order), Top is the same batch re-sorted client-side
 * by real likesCount. This is deliberately NOT a fetched-separately
 * "true top of all time" ranking (that would need a second, unbounded
 * query or a maintained aggregate this schema doesn't have) — it's an
 * honest "most-liked among the recent batch," which is what "priority
 * is correctness over fake sophistication" asks for here.
 */
export default function HashtagPage() {
  const { tag: rawTag } = useParams()
  const navigate = useNavigate()
  const tag = normalizeHashtag(rawTag)

  const [posts, setPosts] = useState([])
  const [count, setCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('Recent')

  useEffect(() => {
    if (!tag) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const uid = auth.currentUser?.uid

    Promise.all([searchPostsByHashtag(tag, uid, { resultLimit: PAGE_SIZE }), getHashtagPostCount(tag)])
      .then(([postsData, countData]) => {
        if (cancelled) return
        setPosts(postsData)
        setCount(countData)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load this hashtag.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tag])

  const displayedPosts = useMemo(() => {
    if (activeTab === 'Top') return [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0))
    return posts
  }, [posts, activeTab])

  return (
    <div className="h-full w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[680px] bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-base font-bold tracking-tight text-gray-900 dark:text-gray-50 truncate">
                <Hash className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                {tag || 'hashtag'}
              </p>
              {count !== null && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {count} {count === 1 ? 'post' : 'posts'}
                </p>
              )}
            </div>
          </div>

          {posts.length > 0 && (
            <div className="flex items-center px-3 pb-2 gap-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                    activeTab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </header>

        <main className="pb-10">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader size="lg" tone="dark" />
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Couldn't load this hashtag</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <Hash className="w-6 h-6" strokeWidth={1.7} />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-50">#{tag}</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">No posts yet</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed">
                Be the first to use this hashtag on your campus.
              </p>
              <button
                type="button"
                onClick={() => navigate('/create')}
                className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-200"
              >
                Create a post
              </button>
            </div>
          ) : (
            <div className="pt-3">
              {displayedPosts.map((post) => (
                <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
