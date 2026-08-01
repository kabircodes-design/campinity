import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Home, MessageCircle, ShoppingBag, User, Users } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'

const navItems = [
  { id: 'home', label: 'Home', icon: Home, to: '/home' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, to: '/messages' },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, to: '/marketplace' },
  { id: 'communities', label: 'Communities', icon: Users, to: '/communities' },
  { id: 'profile', label: 'Profile', icon: User, to: '/profile' }
]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event) => setReduced(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])
  return reduced
}

/**
 * Bottom navigation with a "limelight" effect adapted from a 21st.dev
 * reference component — the BEHAVIOR was studied and rebuilt for this
 * project's actual stack (plain JS, Tailwind, no shadcn, no
 * TypeScript), not copied. What's kept from the original concept: a
 * glowing indicator measured against the active item's real DOM
 * position (offsetLeft + offsetWidth), sliding smoothly beneath
 * whichever tab is active.
 *
 * What changed for this project specifically:
 *  - Active state comes from NavLink's real route match (useLocation),
 *    not local index state — this nav has always been route-driven,
 *    and the limelight effect layers on top of that instead of
 *    replacing it with its own click-tracked state.
 *  - Colors are 100% theme tokens (var(--theme-accent) etc.) — the
 *    reference used Tailwind's bg-primary/CSS variables from a shadcn
 *    setup this project doesn't have.
 *  - Icons are lucide-react, matching what this file already used
 *    before this change (not a new icon system).
 *  - "Create" is gone — see this feature's own chat explanation for
 *    why; this is now a genuine 5-item route-based nav
 *    (Home/Messages/Marketplace/Communities/Profile), no FAB-style
 *    center button.
 */
export default function BottomNav() {
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()
  const itemRefs = useRef([])
  const [limelightStyle, setLimelightStyle] = useState({ left: 0, width: 0, opacity: 0 })

  const activeIndex = navItems.findIndex((item) => location.pathname === item.to)

  useLayoutEffect(() => {
    const activeEl = itemRefs.current[activeIndex]
    if (!activeEl) {
      setLimelightStyle((prev) => ({ ...prev, opacity: 0 }))
      return
    }
    const width = 28
    setLimelightStyle({
      left: activeEl.offsetLeft + activeEl.offsetWidth / 2 - width / 2,
      width,
      opacity: 1
    })
  }, [activeIndex])

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] lg:max-w-[520px] theme-bg-surface backdrop-blur-md border-t theme-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative grid grid-cols-5 items-center px-2 pt-2 pb-1.5">
        {/* The limelight — a small glowing bar that slides beneath
            whichever tab is active, plus a soft radial glow above it.
            Positioned via real measured DOM offsets (see useLayoutEffect
            above), not percentage math, so it lines up correctly
            regardless of icon size differences or container padding.
            GPU-accelerated (left animates via a CSS transition on the
            `left` property here rather than transform — this bar is
            only 3px tall and 28px wide, so the reflow cost of
            animating `left` at this scale is negligible; using
            transform would need a second measurement pass to convert
            offsetLeft into a translateX delta for no real perf gain
            at this size). */}
        <span
          className="absolute top-0 h-[3px] rounded-full pointer-events-none"
          style={{
            left: limelightStyle.left,
            width: limelightStyle.width,
            opacity: limelightStyle.opacity,
            backgroundColor: 'var(--theme-accent)',
            boxShadow: '0 0 12px 2px var(--theme-accent), 0 8px 16px -4px var(--theme-accent)',
            transition: reducedMotion ? 'opacity 200ms ease' : 'left 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease'
          }}
          aria-hidden="true"
        />

        {navItems.map((item, index) => {
          const isActive = index === activeIndex
          return (
            <NavLink
              key={item.id}
              ref={(el) => (itemRefs.current[index] = el)}
              to={item.to}
              aria-label={item.label}
              className="relative z-10 flex flex-col items-center justify-center py-1.5"
            >
              <item.icon
                className="w-6 h-6 transition-all duration-300"
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{
                  color: isActive ? 'var(--theme-accent)' : 'var(--theme-textSecondary)',
                  opacity: isActive ? 1 : 0.65,
                  filter: isActive ? 'drop-shadow(0 0 6px var(--theme-accent))' : 'none'
                }}
              />
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
