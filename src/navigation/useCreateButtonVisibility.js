import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// How far (px) the page must move in one direction before the floating
// + reacts — small jitters and momentum bounce never toggle it.
export const SCROLL_DELTA_THRESHOLD = 8
// Near the top of a page the + is always shown: nothing has scrolled
// under it yet.
export const TOP_ZONE = 64

/**
 * Screens where "create a post" is the natural next action. Everywhere
 * else the floating + used to sit on top of form fields, settings rows and
 * pages that already have their own primary action (Marketplace "Sell",
 * Messages compose, Lost & Found "Report"), so it is not shown there.
 */
export const CREATE_BUTTON_ROUTES = ['/home', '/communities', '/profile']
export const isCreateButtonRoute = (pathname) => {
  let p = String(pathname || '')
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return CREATE_BUTTON_ROUTES.includes(p)
}

/**
 * Pure rule for the floating Create (+) button, Instagram / Material
 * "hide on scroll" style:
 *  - scrolling down (reading): hide, so it never sits on top of feed or
 *    list content while the user is reading it;
 *  - scrolling up, or back near the top: show again.
 * Returns the new visibility.
 */
export function nextCreateButtonVisibility(visible, { position, delta }) {
  if (position <= TOP_ZONE) return true
  if (delta >= SCROLL_DELTA_THRESHOLD) return false
  if (delta <= -SCROLL_DELTA_THRESHOLD) return true
  return visible
}

function readScrollTop(target) {
  if (!target || target === document || target === document.documentElement || target === document.body) {
    return window.scrollY || document.documentElement.scrollTop || 0
  }
  return typeof target.scrollTop === 'number' ? target.scrollTop : 0
}

/**
 * Tracks vertical scrolling anywhere in the app (the mobile pages scroll
 * the document; a few panels scroll an inner element), using one
 * capture-phase listener. Horizontal-only scrollers (chip rows, story
 * carousels) never change scrollTop, so they never toggle the button.
 * Shown again on every route change.
 */
export function useCreateButtonVisibility() {
  const [visible, setVisible] = useState(true)
  const { pathname } = useLocation()
  const allowedHere = isCreateButtonRoute(pathname)
  const lastTop = useRef(new WeakMap())
  // Accumulates movement in one direction, so a slow scroll (a few px
  // per event) still crosses the threshold.
  const run = useRef({ target: null, delta: 0 })
  const visibleRef = useRef(true)

  useEffect(() => {
    setVisible(true)
    visibleRef.current = true
    run.current = { target: null, delta: 0 }
  }, [pathname])

  useEffect(() => {
    const onScroll = (event) => {
      const target = event.target === document || event.target === window ? document.documentElement : event.target
      if (!target || typeof target !== 'object') return
      const top = readScrollTop(target)
      const previous = lastTop.current.get(target)
      lastTop.current.set(target, top)
      if (previous === undefined) return
      const step = top - previous
      if (step === 0) return

      const current = run.current
      const sameDirection = current.target === target && Math.sign(current.delta) === Math.sign(step)
      const delta = sameDirection ? current.delta + step : step
      run.current = { target, delta }

      const next = nextCreateButtonVisibility(visibleRef.current, { position: top, delta })
      if (next !== visibleRef.current) {
        visibleRef.current = next
        run.current = { target, delta: 0 }
        setVisible(next)
      }
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [])

  return allowedHere && visible
}
