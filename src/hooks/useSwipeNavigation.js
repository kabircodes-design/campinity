import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * The fixed swipe order — matches BottomNav's real navigable tabs.
 * "Create" was removed from bottom nav entirely (see BottomNav.jsx) —
 * it isn't part of this order because there's no longer a bottom-nav
 * item for it to correspond to. "Communities" is new — routes to
 * DiscoverCommunitiesPage.jsx.
 */
export const SWIPE_TAB_ORDER = ['/home', '/messages', '/marketplace', '/communities', '/profile']

const HORIZONTAL_INTENT_RATIO = 1.6 // how much more horizontal than vertical movement must be, before this counts as a swipe and not a scroll
const MIN_INTENT_DISTANCE = 10 // px of movement before we even try to classify direction — ignores jitter/taps
const COMPLETE_THRESHOLD = 0.32 // fraction of viewport width dragged before a release completes the navigation
const VELOCITY_THRESHOLD = 0.55 // px/ms — a fast flick completes navigation even under the distance threshold

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
 * Reusable edge-swipe navigation — one hook, called once per swipeable
 * page (HomePage, MessagesPage, MarketplacePage/ComingSoon, ProfilePage),
 * not duplicated gesture code per file. Returns `dragX` (a plain number,
 * not a ref) and `isDragging` so the calling page can apply
 * `transform: translate3d(${dragX}px, 0, 0)` to its own root element —
 * this hook never touches the DOM directly, it only computes state.
 *
 * Horizontal-intent detection: tracks raw dx/dy from touch/pointer start,
 * and does NOT commit to "this is a swipe" until movement exceeds
 * MIN_INTENT_DISTANCE AND |dx| > |dy| * HORIZONTAL_INTENT_RATIO. Until
 * that commitment, nothing is dragged and no scroll is prevented —
 * vertical scroll always wins by default, exactly as asked. Once
 * committed horizontal, e.preventDefault() stops the page from ALSO
 * scrolling vertically for the rest of that gesture.
 *
 * Pointer Events (not separate touch/mouse handlers) cover touch,
 * mouse, AND trackpad-as-mouse-drag in one implementation — this is
 * what "support touch devices, trackpads, desktop mouse drag" resolves
 * to technically. Desktop mouse drag is still opt-in only via an
 * actual press-and-drag gesture (not e.g. scroll-wheel), so normal
 * desktop usage (clicking buttons, scrolling with a wheel) is
 * unaffected.
 */
export function useSwipeNavigation(currentPath) {
  const navigate = useNavigate()
  const reducedMotion = usePrefersReducedMotion()

  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const stateRef = useRef({
    active: false,
    committedDirection: null, // 'horizontal' | 'vertical' | null
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0
  })

  const currentIndex = SWIPE_TAB_ORDER.indexOf(currentPath)
  const canGoNext = currentIndex >= 0 && currentIndex < SWIPE_TAB_ORDER.length - 1
  const canGoPrev = currentIndex > 0

  const resetDrag = useCallback(() => {
    setDragX(0)
    setIsDragging(false)
    stateRef.current.active = false
    stateRef.current.committedDirection = null
  }, [])

  useEffect(() => {
    if (reducedMotion || currentIndex === -1) return undefined

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      stateRef.current = {
        active: true,
        committedDirection: null,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        lastX: event.clientX,
        lastTime: performance.now()
      }
    }

    const handlePointerMove = (event) => {
      const state = stateRef.current
      if (!state.active) return

      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY

      if (state.committedDirection === null) {
        const distance = Math.hypot(dx, dy)
        if (distance < MIN_INTENT_DISTANCE) return
        state.committedDirection = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_INTENT_RATIO ? 'horizontal' : 'vertical'
        if (state.committedDirection === 'horizontal') setIsDragging(true)
      }

      if (state.committedDirection !== 'horizontal') return

      // Clamp: can't drag past the first tab going right, or past the last tab going left.
      let clamped = dx
      if (dx > 0 && !canGoPrev) clamped = 0
      if (dx < 0 && !canGoNext) clamped = 0

      event.preventDefault()
      state.lastX = event.clientX
      state.lastTime = performance.now()
      setDragX(clamped)
    }

    const handlePointerUp = () => {
      const state = stateRef.current
      if (!state.active || state.committedDirection !== 'horizontal') {
        resetDrag()
        return
      }

      const dx = state.lastX - state.startX
      const elapsed = Math.max(1, state.lastTime - state.startTime)
      const velocity = Math.abs(dx) / elapsed
      const viewportWidth = window.innerWidth || 1
      const distanceRatio = Math.abs(dx) / viewportWidth

      const shouldComplete = distanceRatio > COMPLETE_THRESHOLD || velocity > VELOCITY_THRESHOLD

      if (shouldComplete && dx < 0 && canGoNext) {
        navigate(SWIPE_TAB_ORDER[currentIndex + 1], { state: { swipeDirection: 'forward' } })
      } else if (shouldComplete && dx > 0 && canGoPrev) {
        navigate(SWIPE_TAB_ORDER[currentIndex - 1], { state: { swipeDirection: 'backward' } })
      }

      resetDrag()
    }

    // Listening on window (not a specific element) is what lets this
    // hook work without every page needing to attach a ref to its own
    // root node — the page only needs dragX/isDragging back to apply
    // the transform itself.
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handlePointerUp, { passive: true })

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [currentIndex, canGoNext, canGoPrev, navigate, reducedMotion, resetDrag])

  return { dragX, isDragging, canGoNext, canGoPrev }
}
