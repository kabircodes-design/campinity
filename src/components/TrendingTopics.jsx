import { useMemo } from 'react'
import { Flame } from 'lucide-react'

/**
 * "Trending Now" — real topic counts derived from posts' own `category`
 * field (general/study/notes/event/club/marketplace, the same six tags
 * CreatePostPage.jsx's composer already uses), not fabricated hashtags.
 * This app has no hashtag-extraction system, so a literal "#hashtag"
 * widget would have to invent data — this uses the one real
 * topic-like signal that already exists instead. Zero new Firestore
 * query: computed from the same `posts` array HomePage.jsx already
 * fetches for the feed and CampusPulse.
 */
const CATEGORY_LABELS = {
  general: 'General',
  study: 'Study',
  notes: 'Notes',
  event: 'Events',
  club: 'Clubs',
  marketplace: 'Marketplace'
}

export default function TrendingTopics({ posts }) {
  const topics = useMemo(() => {
    const counts = new Map()
    posts.forEach((post) => {
      const key = post.category || 'general'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count, label: CATEGORY_LABELS[key] || key }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [posts])

  if (topics.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
        <Flame className="w-4 h-4 text-orange-500" /> Trending Now
      </p>
      <div className="space-y-2.5">
        {topics.map((topic) => (
          <div key={topic.key} className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              #
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{topic.label}</p>
              <p className="text-[11px] text-gray-400">{topic.count} {topic.count === 1 ? 'post' : 'posts'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
