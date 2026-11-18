import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAdjacentTabPath, getMainTabIndex } from './mainTabs.js'
import { classifyIntent, dragOffset, resolveSwipe, shouldIgnoreSwipeStart } from './swipeGesture.js'
import { prefetchRoute } from '../routePrefetch.js'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Instagram-style horizontal swipe between the main tabs — ONE shared
 * mechanism, attached by AppShell to the element that hosts every tab
 * page, instead of per-page gesture code.
 *
 * Returns a ref for that element. On a main-tab route, a horizontal
 * touch drag moves the page with the finger and, past the threshold,
 * navigates to the neighbouring tab in MAIN_TABS order (the same list
 * BottomNav renders, so its active item follows automatically).
 *
 * Deliberate limits:
 *  - Touch only. Desktop has the sidebar; mouse drags must keep
 *    selecting text.
 *  - Vertical scrolling always wins unless the gesture is clearly
 *    horizontal (swipeGesture.js thresholds).
 *  - Swipes that start in inputs, sliders, media or any horizontally
 *    scrollable area are ignored (shouldIgnoreSwipeStart), as are
 *    multi-touch gestures and anything outside this element — modals
 *    and sheets are portaled to <body>, so they never trigger it.
 *  - The transform exists only while a drag/snap-back is in progress
 *    and is removed afterwards: a lingering transform would turn this
 *    element into the containing block for position:fixed descendants.
 *  - prefers-reduced-motion: the gesture still navigates, but nothing
 *    follows the finger.
 */
export function useTabSwipe() {
  const ref = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    const el = ref.current
    if (!el || getMainTabIndex(pathname) === -1) return undefined

    const nextPath = getAdjacentTabPath(pathname, 1)
    const prevPath = getAdjacentTabPath(pathname, -1)
    const limits = { canGoNext: !!nextPath, canGoPrev: !!prevPath }
    const reducedMotion = prefersReducedMotion()
    let gesture = null
    let settleTimer = null

    const clearTransform = () => {
      el.style.transition = ''
      el.style.transform = ''
      el.style.opacity = ''
      el.style.willChange = ''
    }

    const settleBack = () => {
      if (reducedMotion || !el.style.transform) {
        clearTransform()
        return
      }
      el.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease'
      el.style.transform = 'translate3d(0, 0, 0)'
      el.style.opacity = '1'
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(clearTransform, 240)
    }

    const onTouchStart = (event) => {
      if (event.touches.length !== 1 || shouldIgnoreSwipeStart(event.target, el)) {
        gesture = null
        return
      }
      const touch = event.touches[0]
      gesture = { startX: touch.clientX, startY: touch.clientY, startTime: performance.now(), dx: 0, intent: null }
    }

    const onTouchMove = (event) => {
      if (!gesture) return
      if (event.touches.length !== 1) {
        gesture = null
        settleBack()
        return
      }
      const touch = event.touches[0]
      const dx = touch.clientX - gesture.startX
      const dy = touch.clientY - gesture.startY

      if (gesture.intent === null) {
        gesture.intent = classifyIntent(dx, dy)
        if (gesture.intent === 'horizontal') {
          window.clearTimeout(settleTimer)
          const target = dx < 0 ? nextPath : prevPath
          if (target) prefetchRoute(target)
        }
      }
      if (gesture.intent !== 'horizontal') {
        if (gesture.intent === 'vertical') gesture = null
        return
      }

      // Ours now: stop the browser from also scrolling/navigating.
      if (event.cancelable) event.preventDefault()
      gesture.dx = dx
      if (reducedMotion) return
      const offset = dragOffset(dx, limits)
      el.style.willChange = 'transform'
      el.style.transition = 'none'
      el.style.transform = `translate3d(${offset}px, 0, 0)`
      el.style.opacity = String(Math.max(0.55, 1 - Math.abs(offset) / (window.innerWidth * 1.6)))
    }

    const onTouchEnd = () => {
      if (!gesture) return
      const finished = gesture
      gesture = null
      if (finished.intent !== 'horizontal') return
      const result = resolveSwipe({
        dx: finished.dx,
        elapsedMs: performance.now() - finished.startTime,
        viewportWidth: window.innerWidth || 1,
        ...limits
      })
      if (result === 0) {
        settleBack()
        return
      }
      // The incoming page plays its own directional slide-in (AppShell),
      // so drop the drag transform immediately rather than animating out.
      clearTransform()
      navigate(result === 1 ? nextPath : prevPath)
    }

    const onTouchCancel = () => {
      if (!gesture) return
      gesture = null
      settleBack()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      window.clearTimeout(settleTimer)
      clearTransform()
    }
  }, [pathname, navigate])

  return ref
}
