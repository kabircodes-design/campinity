import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Radar } from 'lucide-react'
import DesktopSidebar from './DesktopSidebar.jsx'
import BottomNav from './BottomNav.jsx'
import Logo from './Logo.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUnreadCount } from '../firebase/notificationService.js'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * The persistent app shell — sidebar, global header and bottom nav are
 * mounted ONCE here and never remount on navigation between the 5
 * pages that use it (Home, Communities, Marketplace, Lost & Found,
 * Messages — see App.jsx's layout-route grouping). Only <Outlet/>'s
 * content changes.
 *
 * This is a literal extraction of the header/sidebar markup that was
 * previously byte-for-byte duplicated across those 5 pages (each one
 * independently fetched its own profile and unread count just to feed
 * this exact same header — see AuthContext.jsx and this file's own
 * subscribeToUnreadCount call for why that was the actual root cause
 * of the "navigation feels like a fresh page load" complaint, not
 * something CSS alone could fix).
 *
 * Each page keeps its OWN scroll/overflow choice for its content — this
 * component only provides a height-constrained `flex-1 min-h-0` slot
 * (not a fixed `overflow-y-auto`), because Messages deliberately does
 * NOT want whole-page scrolling (it manages its own internal chat-list/
 * conversation scroll regions), while Home/Communities/Marketplace/
 * Lost & Found each scroll as one normal block — forcing one behavior
 * here would have broken one or the other.
 */
export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    const unsubscribe = subscribeToUnreadCount(uid, setUnreadNotifCount)
    return () => unsubscribe()
  }, [])

  return (
    <>
      <div
        className="relative overflow-x-hidden lg:grid lg:h-screen lg:overflow-hidden lg:[grid-template-columns:minmax(240px,280px)_1fr] bg-[#f8fafc] dark:bg-[#09090f]"
      >
        <DesktopSidebar unreadNotifications={unreadNotifCount} profile={profile} />

        {/* lg:h-screen/lg:overflow-hidden — DESKTOP only, matching what
            every one of these pages' own outer wrapper already had.
            Deliberately NOT applied on mobile: Home/Communities/
            Marketplace/Lost & Found rely on normal document scroll
            with a `sticky` header on mobile today, and forcing a fixed-
            viewport flex column there too would silently change that
            for all four of them. Messages is the one exception (it
            already needs a fixed-height shell on mobile too, for its
            fixed composer) — it asserts that itself via `h-screen
            lg:h-full` on its own remaining content, which works
            correctly against both this conditional wrapper on desktop
            and no wrapper constraint at all on mobile. */}
        <div className="flex flex-col lg:h-screen lg:overflow-hidden overflow-x-hidden min-w-0">
          <header className="sticky top-0 z-40 bg-white dark:bg-[#11131a] border-b border-gray-100 dark:border-white/10 flex-shrink-0">
            <div className="h-14 flex items-center gap-3 px-4 lg:px-6">
              <button
                type="button"
                onClick={() => navigate('/home')}
                aria-label="Campinity — go to Home"
                className="lg:hidden flex items-center flex-shrink-0"
              >
                <Logo className="w-7 h-7" withWordmark />
              </button>

              {/* Messages/Notifications/Profile were removed from here —
                  DesktopSidebar already lists all three as real nav items
                  on desktop, and BottomNav covers them on mobile, so this
                  was a genuinely redundant second entry point, not a
                  second way to reach something otherwise unreachable.
                  Radar stays: it has no equivalent entry in either nav.
                  ml-auto still correctly right-aligns it now that there's
                  no flex-1 sibling pushing it — no phantom gap left
                  behind, the header just naturally shrinks to fit. */}
              <button
                type="button"
                aria-label="Radar"
                onClick={() => navigate('/radar')}
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95 transition-all duration-200 ml-auto"
              >
                <Radar className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 min-h-0">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <Loader size="lg" tone="dark" />
                </div>
              }
            >
              {/* Keyed by pathname so switching between shell pages
                  retriggers a short, subtle fade — the sidebar/header
                  above never re-render because of this key, only this
                  wrapper and whatever Outlet renders inside it. */}
              <div key={location.pathname} className="h-full [animation:campinity-fade-up_0.2s_ease-out_both]">
                <Outlet />
              </div>
            </Suspense>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </>
  )
}
