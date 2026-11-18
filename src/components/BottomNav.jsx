import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { prefetchRoute } from '../routePrefetch.js'
import { auth } from '../firebase/firebase.js'
import { subscribeToUnreadChatsCount } from '../firebase/chatService.js'
import { CREATE_POST_PATH, MAIN_TABS, getMainTabIndex } from '../navigation/mainTabs.js'
import { useCreateButtonVisibility } from '../navigation/useCreateButtonVisibility.js'

/**
 * Mobile bottom navigation: the five main tabs (icon + label) from
 * MAIN_TABS — the same list and order the swipe navigation uses — plus
 * a floating Create (+) button centred just above the bar.
 *
 * - Active state comes from the real route (useLocation), so a swipe, a
 *   tap and Android's back button all light up the same item.
 * - The + is an action, not a tab: it opens the existing Create Post
 *   page and never shows a selected state.
 * - Overlap: the + floats over the page, so it slides away while the
 *   user scrolls down (reading) and comes back on scroll up, near the
 *   top of a page, and on every route change
 *   (useCreateButtonVisibility). The bar itself never moves, and pages
 *   keep their existing bottom inset for the bar — no extra blank space.
 * - Colours are theme tokens (var(--theme-accent) etc.), so Light and
 *   Dark both keep their existing palettes.
 * - Bottom padding covers the Android gesture area (safe-area inset).
 */
export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [unreadChats, setUnreadChats] = useState(0)
  const createVisible = useCreateButtonVisibility()

  // Self-contained on purpose — this component is mounted from several
  // pages (AppShell plus standalone renders), so a real subscription
  // here (not a prop threaded through every call site) is the
  // maintainable option. Cleaned up on unmount like every other listener.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    const unsubscribe = subscribeToUnreadChatsCount(uid, setUnreadChats)
    return () => unsubscribe()
  }, [])

  const activeIndex = getMainTabIndex(location.pathname)
  const unreadLabel = unreadChats > 9 ? '9+' : String(unreadChats)

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] lg:max-w-[520px] theme-bg-surface backdrop-blur-md border-t theme-border"
      style={{ paddingBottom: 'var(--app-safe-bottom, env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        aria-label="Create post"
        aria-hidden={createVisible ? undefined : 'true'}
        tabIndex={createVisible ? 0 : -1}
        data-visible={createVisible ? 'true' : 'false'}
        onClick={() => navigate(CREATE_POST_PATH)}
        onTouchStart={() => prefetchRoute(CREATE_POST_PATH)}
        className={`absolute left-1/2 bottom-full mb-3 w-[52px] h-[52px] -ml-[26px] rounded-full flex items-center justify-center text-white transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none active:scale-95 ${
          createVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-75 pointer-events-none'
        }`}
        style={{
          backgroundColor: 'var(--theme-accent)',
          boxShadow: '0 8px 20px -6px var(--theme-accent), 0 2px 6px rgba(15, 23, 42, 0.18)'
        }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.4} />
      </button>

      <div className="grid grid-cols-5 items-stretch px-1 pt-1.5 pb-1">
        {MAIN_TABS.map((item, index) => {
          const isActive = index === activeIndex
          const showUnread = item.id === 'messages' && unreadChats > 0
          return (
            <NavLink
              key={item.id}
              to={item.to}
              aria-label={showUnread ? `${item.label} — ${unreadChats} unread` : item.label}
              aria-current={isActive ? 'page' : undefined}
              onTouchStart={() => prefetchRoute(item.to)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 min-w-0"
              style={{ color: isActive ? 'var(--theme-accent)' : 'var(--theme-textSecondary)' }}
            >
              <span
                className="relative flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200"
                style={{
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--theme-accent) 13%, transparent)' : 'transparent'
                }}
              >
                <item.icon
                  className="w-[22px] h-[22px] transition-opacity duration-200"
                  strokeWidth={isActive ? 2.2 : 1.8}
                  style={{ opacity: isActive ? 1 : 0.75 }}
                />
                {showUnread && (
                  <span
                    className="absolute -top-1 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-white dark:ring-[#09090f]"
                    aria-hidden="true"
                  >
                    {unreadLabel}
                  </span>
                )}
              </span>
              {/* Five slots: a slot is 70px+ even at 360px, so 10px labels
                  ("Communities" measured 61.7px on the device) fit whole. */}
              <span
                className={`max-w-full whitespace-nowrap text-[10px] leading-tight tracking-[-0.01em] ${isActive ? 'font-semibold' : 'font-medium'}`}
                style={{ opacity: isActive ? 1 : 0.8 }}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
