/**
 * Hover/focus-triggered route prefetching for the primary nav
 * destinations. Calling the same dynamic import() a route's own
 * React.lazy() already uses is safe and cheap to call again — ESM
 * dynamic imports are memoized per specifier by the module loader, so
 * hovering a link just kicks off (or reuses) the exact same fetch the
 * click would have triggered anyway, just earlier. No new
 * infrastructure, no data prefetching (that stays untouched — only
 * route CODE, per the explicit "don't aggressively preload data"
 * instruction).
 */
const importers = {
  '/home': () => import('./pages/HomePage.jsx'),
  '/search': () => import('./pages/SearchPage.jsx'),
  '/communities': () => import('./pages/CommunitiesHubPage.jsx'),
  '/marketplace': () => import('./marketplace/MarketplacePage.jsx'),
  '/lost-found': () => import('./pages/LostFoundPage.jsx'),
  '/messages': () => import('./pages/MessagesPage.jsx'),
  '/notifications': () => import('./pages/NotificationsPage.jsx'),
  '/profile': () => import('./pages/ProfilePage.jsx'),
  '/settings': () => import('./pages/SettingsPage.jsx')
}

const prefetched = new Set()

export function prefetchRoute(path) {
  if (prefetched.has(path)) return
  const importer = importers[path]
  if (!importer) return
  prefetched.add(path)
  importer().catch(() => {
    // A failed prefetch just means the real navigation's own Suspense
    // fallback handles it as normal — never block/crash on this.
    prefetched.delete(path)
  })
}
