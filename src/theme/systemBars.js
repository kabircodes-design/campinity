import { useEffect } from 'react'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

/**
 * Android status/navigation-bar icon colour, kept in sync with the APP's
 * theme instead of the phone's. With edge-to-edge (targetSdk 36) both
 * bars are transparent, so what sits behind them is Campinity's own
 * content: the theme-coloured status-bar strip (theme-tokens.css) and the
 * page/bottom-nav background. Capacitor's default style follows the
 * phone's system night mode, which made the icons invisible whenever the
 * two disagreed (e.g. phone in dark mode, Campinity in Light theme).
 *
 * The theme drives the style (ThemeProvider calls syncSystemBarsWithTheme
 * on every resolved-theme change, so switching theme updates the bars
 * immediately). Full-screen overlays whose background ignores the theme
 * (always-black story/call screens, always-white flows) push a temporary
 * override with useSystemBarsOverride; the most recent active one wins.
 * No-op on web.
 */

let themeIsDark = false
const overrides = []

/** 'dark' = dark background behind the bars (light icons); 'light' = the reverse. */
export function getEffectiveSystemBarsBackground() {
  const latest = overrides[overrides.length - 1]
  if (latest) return latest.background
  return themeIsDark ? 'dark' : 'light'
}

function apply() {
  if (!Capacitor.isNativePlatform()) return
  // Capacitor's naming describes the BACKGROUND: Dark = light icons.
  const style = getEffectiveSystemBarsBackground() === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light
  // No `bar` option: applies to both the status bar and the navigation/
  // gesture bar, so the bottom system area keeps matching contrast too.
  SystemBars.setStyle({ style }).catch(() => {})
}

export function syncSystemBarsWithTheme(isDark) {
  themeIsDark = isDark
  apply()
}

export function useSystemBarsOverride(background, active = true) {
  useEffect(() => {
    if (!active || !background) return undefined
    const entry = { background }
    overrides.push(entry)
    apply()
    return () => {
      const index = overrides.indexOf(entry)
      if (index !== -1) overrides.splice(index, 1)
      apply()
    }
  }, [background, active])
}
