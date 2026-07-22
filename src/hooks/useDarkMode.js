import { useEffect, useState } from 'react'

const STORAGE_KEY = 'campinity:theme'

function getInitialTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark'
  } catch {
    return false
  }
}

/**
 * Reads/writes the dark-mode preference (persisted in localStorage) and
 * keeps the `dark` class on <html> in sync with it — theme.css does the
 * actual re-coloring based on that class being present.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      window.localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
    } catch {
      // Storage unavailable — theme still applies for this session, just won't persist.
    }
  }, [isDark])

  return [isDark, setIsDark]
}