import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { resolveBackAction } from './backNavigation.js'
import { closeTopOverlay } from './overlayBackStack.js'

/**
 * Android hardware Back for the whole app. Mounted once from App.jsx.
 *
 * Without a 'backButton' listener, Capacitor's default behaviour closes
 * the app from every screen. With one, Capacitor hands the press to us;
 * resolveBackAction (backNavigation.js) decides what happens.
 *
 * - Registered once: the current route is read from a ref, so
 *   navigating never re-registers (no duplicate listeners), and the
 *   listener is removed on unmount.
 * - "In-app history" is React Router's own index (history.state.idx),
 *   so it only counts screens visited inside Campinity.
 * - Exit uses minimizeApp(): on current Android, Back at an app's root
 *   sends it to the background rather than destroying it, so reopening
 *   is instant and nothing is lost.
 * - Web/desktop: does nothing; browser Back keeps working as before.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathnameRef = useRef(location.pathname)
  pathnameRef.current = location.pathname
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let handle = null
    let removed = false

    App.addListener('backButton', () => {
      // An open sheet/dialog/viewer closes first; only then navigate.
      if (closeTopOverlay()) return
      const rawIndex = window.history.state?.idx
      const historyIndex = Number.isFinite(rawIndex) ? rawIndex : 0
      const action = resolveBackAction(pathnameRef.current, historyIndex)
      if (action.type === 'exit') {
        App.minimizeApp().catch(() => App.exitApp())
      } else if (action.type === 'history') {
        navigateRef.current(-1)
      } else {
        navigateRef.current(action.to, { replace: action.replace })
      }
    }).then((h) => {
      // Unmounted before registration finished: remove it straight away.
      if (removed) h.remove()
      else handle = h
    })

    return () => {
      removed = true
      handle?.remove()
    }
  }, [])
}
