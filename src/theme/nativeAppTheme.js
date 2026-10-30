import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Tells Android which theme Campinity is set to, so the NEXT launch's
 * native splash screen (drawn before the WebView or React exist) uses the
 * same light/dark background. See android/.../AppThemePlugin.java.
 *
 * Takes the theme MODE ('light' | 'dark' | 'system'), not the resolved
 * value: 'system' must keep following the phone, including if the phone's
 * setting changes while Campinity is closed. No-op on web.
 */
const AppTheme = registerPlugin('AppTheme')

let lastMode = null

export function syncNativeAppTheme(mode) {
  if (!Capacitor.isNativePlatform() || mode === lastMode) return
  lastMode = mode
  AppTheme.setNightMode({ mode }).catch(() => {})
}
