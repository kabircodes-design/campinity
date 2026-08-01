import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SWIPE_TAB_ORDER, useSwipeNavigation } from '../hooks/useSwipeNavigation.js'

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
 * Wrap a swipeable page's existing root JSX with this component —
 * one line added per page, not a rewrite of the page itself:
 *
 *   export default function HomePage() {
 *     ...
 *     return (
 *       <SwipeablePage>
 *         <div className="min-h-screen ...">...</div>
 *       </SwipeablePage>
 *     )
 *   }
 *
 * Two things happen here, layered together:
 *  1. LIVE DRAG — useSwipeNavigation's dragX is applied as a
 *     translate3d transform directly on this wrapper while the user is
 *     actively dragging. GPU-accelerated (translate3d, not left/top),
 *     no layout thrashing (transform doesn't trigger reflow).
 *  2. POST-NAVIGATION SLIDE — once a swipe (or a BottomNav tap, or the
 *     browser back button) actually changes the route, this component
 *     re-mounts key'd by pathname and Framer Motion slides it in from
 *     the correct edge. Direction is derived by comparing the new
 *     path's position in SWIPE_TAB_ORDER against the previous one (via
 *     a ref) — NOT from swipe-only state — so browser back/forward and
 *     BottomNav taps get a consistent, correct directional slide too,
 *     not just gesture-triggered navigation.
 *
 * Honest scope: this animates the CURRENT page being replaced by the
 * NEW one after navigation completes. It does not keep the previous
 * and next pages simultaneously mounted and dragged together — see
 * this feature's own chat explanation for why that's a materially
 * different (and much larger) architecture change than what's built
 * here.
 */
export default function SwipeablePage({ children }) {
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()
  const { dragX, isDragging } = useSwipeNavigation(location.pathname)

  const previousIndexRef = useRef(SWIPE_TAB_ORDER.indexOf(location.pathname))
  const currentIndex = SWIPE_TAB_ORDER.indexOf(location.pathname)
  const direction = currentIndex > previousIndexRef.current ? 1 : currentIndex < previousIndexRef.current ? -1 : 0

  useEffect(() => {
    previousIndexRef.current = currentIndex
  }, [currentIndex])

  if (reducedMotion) {
    // No slide-in, no drag transform — route changes are instant,
    // exactly what prefers-reduced-motion asks for.
    return <>{children}</>
  }

  return (
    <motion.div
      key={location.pathname}
      initial={{ x: direction === 0 ? 0 : `${direction * 100}%`, opacity: direction === 0 ? 1 : 0.4 }}
      animate={{ x: dragX, opacity: 1 }}
      transition={
        isDragging
          ? { duration: 0 }
          : { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }
      }
      style={{
        willChange: 'transform',
        touchAction: isDragging ? 'none' : 'pan-y'
      }}
    >
      {children}
    </motion.div>
  )
}
