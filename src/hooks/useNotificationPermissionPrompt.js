/**
 * Non-blocking, dismissible notification-permission prompt — Android
 * only, shown from Home (see NotificationPermissionBanner.jsx), never
 * during splash/RootRoute/auth resolution (neither of those is touched
 * or imported here). Mirrors useCampusVerificationReminder.js's exact
 * shape: a localStorage-backed "seen/dismissed" flag, nothing else.
 *
 * Deliberately checks the OS permission status itself (not just the
 * local dismissed flag) before showing anything, so a user who already
 * granted or already permanently denied notification access via
 * Android's own system dialog never sees this prompt again either —
 * `perm.receive === 'prompt'` is the one state where showing it is
 * actually useful.
 */
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

const DISMISSED_KEY = 'campinity:notificationPromptDismissed'

export function useNotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    ;(async () => {
      try {
        const dismissed = window.localStorage.getItem(DISMISSED_KEY) === 'true'
        if (dismissed) return
        const status = await PushNotifications.checkPermissions()
        if (!cancelled && status.receive === 'prompt') setShowPrompt(true)
      } catch {
        // Plugin unavailable (e.g. no google-services.json yet) —
        // no prompt, no crash.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const requestPermission = async () => {
    setShowPrompt(false)
    try {
      const result = await PushNotifications.requestPermissions()
      if (result.receive === 'granted') {
        await PushNotifications.register()
      }
    } catch {
      // Never block the app on a permission-request failure.
    }
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // Storage unavailable — the prompt just won't stay dismissed.
    }
    setShowPrompt(false)
  }

  return { showPrompt, requestPermission, dismiss }
}
