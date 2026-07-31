import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './ThemeContext.jsx'
import { THEMES, getThemeById } from './themes.js'

const MODE_KEY = 'campinity:appearanceMode'
const PACK_KEY = 'campinity:themePack'
const LEGACY_DARK_KEY = 'campinity:theme'

function readLocal(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — theme still applies for this session, just won't persist.
  }
}

function getInitialMode() {
  const stored = readLocal(MODE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  const legacy = readLocal(LEGACY_DARK_KEY)
  if (legacy === 'dark') return 'dark'
  if (legacy === 'light') return 'light'
  return 'system'
}

function getInitialPack() {
  const stored = readLocal(PACK_KEY)
  const theme = stored ? getThemeById(stored) : null
  if (theme && !theme.locked) return theme.id
  return 'default'
}

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * The single source of truth for both appearance mode (light/dark/
 * system) and the active theme pack. Applies both to the document:
 *  - Mode resolves to the `.dark` class on <html>, driving
 *    theme-tokens.css's global class-name mappings AND its `html.dark`
 *    variable overrides for the 'default' pack.
 *  - Every non-default theme pack's tokens are applied as CSS custom
 *    properties (--theme-*) on <html>, regardless of mode — a fixed
 *    palette should look like itself whether mode is light, dark, or
 *    system.
 */
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode)
  const [themePackId, setThemePackIdState] = useState(getInitialPack)
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event) => setSystemPrefersDark(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const resolvedIsDark = mode === 'system' ? systemPrefersDark : mode === 'dark'
  const themePack = useMemo(() => getThemeById(themePackId), [themePackId])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedIsDark)
    root.setAttribute('data-theme-pack', themePack.id)

    const shouldApplyTokens = themePack.id !== 'default' && themePack.tokens
    const allTokenKeys = THEMES.flatMap((theme) => (theme.tokens ? Object.keys(theme.tokens) : []))
    const uniqueTokenKeys = Array.from(new Set(allTokenKeys))

    if (shouldApplyTokens) {
      Object.entries(themePack.tokens).forEach(([key, value]) => {
        root.style.setProperty(`--theme-${key}`, value)
      })
    } else {
      uniqueTokenKeys.forEach((key) => root.style.removeProperty(`--theme-${key}`))
    }
  }, [resolvedIsDark, themePack])

  const setMode = useCallback((nextMode) => {
    setModeState(nextMode)
    writeLocal(MODE_KEY, nextMode)
  }, [])

  const setThemePack = useCallback((nextId) => {
    const next = getThemeById(nextId)
    if (next.locked) return
    setThemePackIdState(next.id)
    writeLocal(PACK_KEY, next.id)
  }, [])

  const value = useMemo(
    () => ({ mode, setMode, resolvedIsDark, themePack, setThemePack, themes: THEMES }),
    [mode, setMode, resolvedIsDark, themePack, setThemePack]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
