import { useMemo } from 'react'
import { BarChart3, MessageSquare, TrendingUp, Users } from 'lucide-react'

/**
 * "Quick Stats" — three honest, real metrics derived from data
 * HomePage.jsx already fetches for other purposes (posts, communities),
 * zero new Firestore queries. Per the explicit 'no fake data'
 * instruction, a metric that can't be honestly computed from real data
 * (an "Active Events" count — confirmed via prior audit that this app
 * has no real events backend, EventsShowcase.jsx uses static marketing
 * data, not Firestore) is never included, not invented — this shows
 * Communities / Posts Today / Trending instead, three numbers that are
 * always real.
 *
 * Rebuilt this pass to drop the glassmorphism treatment (border-white/
 * bg-white/60/backdrop-blur) in favor of plain white cards — matches
 * the rest of the redesigned Home page.
 */
export default function CampusPulse({ posts, communities, notesCount }) {
  const stats = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const postsToday = posts.filter((p) => p.createdAtMs && now - p.createdAtMs < oneDayMs).length
    const trendingPosts = posts.filter((p) => (p.likes || 0) + (p.comments || 0) >= 3).length

    return [
      { key: 'communities', icon: Users, value: communities.length, label: communities.length === 1 ? 'Community' : 'Communities', tint: 'bg-blue-50 text-blue-600' },
      { key: 'postsToday', icon: MessageSquare, value: postsToday, label: 'Posts Today', tint: 'bg-emerald-50 text-emerald-600' },
      { key: 'trending', icon: TrendingUp, value: trendingPosts, label: 'Trending', tint: 'bg-pink-50 text-pink-600' }
    ]
  }, [posts, communities])

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
        <BarChart3 className="w-4 h-4 text-blue-500" /> Quick Stats
      </p>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ key, icon: Icon, value, label, tint }) => (
          // ROOT-CAUSE FIX (dark-mode consistency): bg-gray-50/70 is a
          // Tailwind opacity variant theme-tokens.css's global remap
          // doesn't cover (it only maps the base bg-gray-50 and the
          // specific /50 variant) — it rendered as Tailwind's own literal
          // light grey in every mode, so dark mode showed near-white
          // TEXT (correctly remapped) on a still-light TILE (not
          // remapped) — unreadable. dark:bg-white/5 matches the same
          // "subtle raised tile on a dark surface" pattern already used
          // throughout the app.
          //
          // ROOT-CAUSE FIX (overflow): min-w-0 lets the tile shrink to its
          // actual grid track width instead of the CSS Grid default
          // (min-width:auto), which stops the tile itself from forcing the
          // track wider. But the real trigger is the label text: single
          // unbreakable words like "Communities" have no natural space to
          // wrap at, so at this tile's ~70px width the word overflows its
          // own box horizontally instead of wrapping — verified via a
          // headless-browser measurement (scrollWidth > clientWidth on the
          // label). break-words (overflow-wrap: break-word) lets the
          // browser break mid-word when needed, which is what actually
          // keeps the text inside the tile.
          <div key={key} className="min-w-0 rounded-xl bg-gray-50/70 dark:bg-white/5 px-2 py-3 text-center">
            <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center ${tint}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <p className="mt-1.5 text-base font-bold text-gray-900 leading-none">{value}</p>
            <p className="mt-1 text-[10px] text-gray-400 leading-tight break-words">{label}</p>
          </div>
        ))}
      </div>
      {typeof notesCount === 'number' && notesCount > 0 && (
        <p className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400">📚 {notesCount} notes shared on campus</p>
      )}
    </div>
  )
}
