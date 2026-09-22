/**
 * Phase 1 — FCM device registration only. Registers the current
 * install's push token under the signed-in user once permission has
 * already been granted; does NOT request permission itself (that's
 * useNotificationPermissionPrompt.js, triggered from a user tap, never
 * automatically). No notification is ever sent from this app — this
 * hook only keeps users/{uid}/devices/{deviceId} up to date.
 *
 * Reads `user`/`profileSettled` from the EXISTING shared AuthContext
 * (useAuth()) — no second onAuthStateChanged/onSnapshot listener is
 * created; this piggybacks on the one useAuthUser.js already
 * maintains. Mounted once from App.jsx, outside of and unrelated to
 * RootRoute/the route tree, so it runs for the whole session
 * regardless of which page is active, the same way the existing
 * presence heartbeat already does inside useAuthUser.js itself.
 *
 * Every native call is wrapped so a permission denial, a registration
 * error, or the plugin being entirely unavailable (e.g. before
 * google-services.json is added — see this phase's own report) can
 * never throw into the app or block auth/home/chat/calls.
 */
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { useAuth } from '../context/AuthContext.jsx'
import { auth } from '../firebase/firebase.js'
import { getOrCreateDeviceId, registerDevice } from '../firebase/deviceService.js'
import pkg from '../../package.json'

function osVersion() {
  const match = navigator.userAgent.match(/Android\s([\d.]+)/)
  return match ? match[1] : 'unknown'
}

export function useDeviceRegistration() {
  const { user, profileSettled } = useAuth()
  const listenersAttached = useRef(false)

  // Attach the plugin's own event listeners exactly once for the whole
  // app lifetime — App.jsx (where this hook is called) never unmounts.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || listenersAttached.current) return
    listenersAttached.current = true

    PushNotifications.addListener('registration', (token) => {
      // Read auth.currentUser live here, not `user` from the outer
      // closure — this listener is attached once and must reflect
      // whoever is signed in AT THE MOMENT a token arrives, which can
      // be well after this effect first ran.
      const uid = auth.currentUser?.uid
      if (!uid) return
      const deviceId = getOrCreateDeviceId()
      registerDevice(uid, deviceId, { fcmToken: token.value, appVersion: pkg.version, osVersion: osVersion() }).catch(() => {
        // Never block the app on a Firestore write failure here.
      })
    })

    PushNotifications.addListener('registrationError', () => {
      // Swallowed deliberately — registration failing must never
      // surface as an app-breaking error. Nothing to clean up: no
      // partial device doc is written unless a token was received.
    })
  }, [])

  // Once auth has genuinely settled (same profileSettled signal
  // RootRoute uses — not touched, only read) for a signed-in user,
  // check whether notification permission was already granted in an
  // earlier session and re-register if so. This does NOT request
  // permission — see useNotificationPermissionPrompt.js for that.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user || !profileSettled) return
    let cancelled = false
    ;(async () => {
      try {
        const status = await PushNotifications.checkPermissions()
        if (cancelled || status.receive !== 'granted') return
        await PushNotifications.register()
      } catch {
        // Plugin unavailable or permission check failed — no-op.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, profileSettled])
}
