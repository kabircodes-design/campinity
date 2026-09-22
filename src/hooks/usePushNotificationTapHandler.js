/**
 * Phase 3 — notification TAP navigation only. Reuses
 * notificationText.js's getNotificationRoute() (the same function
 * NotificationCard.jsx now calls) so a push tap and an in-app
 * notification-list tap can never navigate differently for the same
 * notification type — one source of truth, not two.
 *
 * Confirmed by reading @capacitor/push-notifications' actual Android
 * source before writing this: Capacitor's own BridgeActivity already
 * forwards onNewIntent to this plugin (Plugin.handleOnNewIntent), and
 * the plugin's own load()/lastMessage mechanism handles a cold start
 * the same way — both a warm-resume tap and a cold-start tap fire the
 * SAME 'pushNotificationActionPerformed' JS event with the same data
 * shape. No MainActivity.java change was needed for either case.
 *
 * The pending-route hold (via React state, not an immediate navigate()
 * call) exists specifically for the cold-start case: this listener can
 * fire before RootRoute has finished resolving auth. Navigating
 * immediately would race RootRoute's own <Navigate> and could be
 * silently overwritten by it. Waiting for the SAME profileSettled/user
 * signals RootRoute itself already reads (via the existing shared
 * useAuth()) avoids that without touching RootRoute at all — same
 * pattern already used for SplashScreen.hide() timing in Phase 1.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { useAuth } from '../context/AuthContext.jsx'
import { getNotificationRoute } from '../utils/notificationText.js'

export function usePushNotificationTapHandler() {
  const navigate = useNavigate()
  const { user, profileSettled } = useAuth()
  const [pendingRoute, setPendingRoute] = useState(null)
  const listenerAttached = useRef(false)
  const lastHandledNotificationId = useRef(null)

  // Attach the tap listener exactly once — App.jsx (where this hook is
  // called) never unmounts.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || listenerAttached.current) return
    listenerAttached.current = true

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action?.notification?.data
      if (!data) return

      // Defensive dedupe — not because a real duplicate tap is
      // expected (Android's Activity lifecycle delivers a tap via
      // exactly one onCreate or onNewIntent call), but cheap to
      // guarantee: the same notificationId can't trigger a second
      // navigation from this handler.
      if (data.notificationId && data.notificationId === lastHandledNotificationId.current) return

      // Uses the EXACT same route map NotificationCard.jsx uses — no
      // route is invented here. If nothing matches (e.g. a 'share'
      // notification, which has no in-app route today either), this
      // is null and nothing happens — the app just opens to wherever
      // it would have opened anyway, rather than guessing.
      const route = getNotificationRoute(data)
      if (!route) return

      lastHandledNotificationId.current = data.notificationId || null
      setPendingRoute(route)
    })
  }, [])

  // Applies a held route once auth has genuinely settled. Re-runs
  // whenever pendingRoute changes (a tap arriving after auth already
  // settled navigates immediately on the next render) or when
  // profileSettled/user later become true (a tap that arrived during
  // cold-start resolution navigates as soon as RootRoute itself would
  // have revealed the app).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    if (!pendingRoute || !user || !profileSettled) return
    setPendingRoute(null)
    navigate(pendingRoute)
  }, [pendingRoute, user?.uid, profileSettled, navigate])
}
