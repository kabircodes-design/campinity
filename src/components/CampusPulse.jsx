import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * "Campus Pulse" metrics strip — every value here is derived from
 * data HomePage.jsx already fetches for other purposes (posts,
 * communities), zero new Firestore queries introduced by this
 * component itself. Per the explicit 'no fake data' instruction, a
 * metric that can't be honestly computed from real data (event
 * counts — confirmed via prior audit that this app has no real
 * events backend, EventsShowcase.jsx uses static marketing data, not
 * Firestore) is simply never included, not invented.
 *
 * "Trending posts" added this pass — a real signal (likes + comments
 * > 0, already present on every mapped post object, no new field).
 */
export default function CampusPulse({ posts, communities, notesCount }) {
  const metrics = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const postsToday = posts.filter((p) => p.createdAtMs && now - p.createdAtMs < oneDayMs).length
    const trendingPosts = posts.filter((p) => (p.likes || 0) + (p.comments || 0) >= 3).length

    const list = []
    if (postsToday > 0) list.push({ emoji: '🔥', value: postsToday, label: postsToday === 1 ? 'new post' : 'new posts' })
    if (trendingPosts > 0) list.push({ emoji: '📈', value: trendingPosts, label: 'trending' })
    if (typeof notesCount === 'number' && notesCount > 0) list.push({ emoji: '📚', value: notesCount, label: 'notes' })
    return list
  }, [posts, communities, notesCount])

  const pulseMessage = useMemo(() => {
    if (metrics.length === 0) return null
    const postsMetric = metrics.find((m) => m.label.includes('post') && !m.label.includes('trending'))
    if (postsMetric) return `${postsMetric.value} new conversation${postsMetric.value === 1 ? '' : 's'} on campus`
    const notesMetric = metrics.find((m) => m.label === 'notes')
    if (notesMetric) return 'New study resources are available'
    return null
  }, [metrics])

  return (
    <div className="mt-3">
      {pulseMessage && <p className="text-xs font-medium text-blue-600 mb-1.5">{pulseMessage}</p>}
      {metrics.length > 0 ? (
        <div className="relative flex items-center gap-4 rounded-2xl border border-white/50 bg-white/60 backdrop-blur-md px-4 py-3.5 overflow-hidden shadow-[0_4px_16px_rgba(91,77,255,0.05)]">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-blue-500/5 blur-2xl pointer-events-none" />
          {metrics.map((m) => (
            <div key={m.label} className="relative flex items-center gap-1.5">
              <span className="text-base">{m.emoji}</span>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">{m.value}</p>
                <p className="text-[10px] text-gray-400">{m.label}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gray-300" />
          <p className="text-xs text-gray-400">🌱 Your campus is quiet right now.</p>
        </div>
      )}
    </div>
  )
}
