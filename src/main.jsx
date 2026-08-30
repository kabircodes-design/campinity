import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { PostsProvider } from './hooks/usePosts.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { PostingStatusProvider } from './context/PostingStatusContext.jsx'
import { getThemeById } from './theme/themes.js'
import './index.css'
import './theme/theme-tokens.css'

// Pre-render flash prevention — mirrors ThemeProvider's own initial
// resolution (mode + theme pack, including the legacy campinity:theme
// migration) so the very first paint already has the right .dark class
// AND the right theme pack colors, before React mounts.
try {
  const storedMode = window.localStorage.getItem('campinity:appearanceMode')
  const legacy = window.localStorage.getItem('campinity:theme')
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

  let shouldBeDark = false
  if (storedMode === 'dark') shouldBeDark = true
  else if (storedMode === 'light') shouldBeDark = false
  else if (storedMode === 'system') shouldBeDark = systemPrefersDark
  else if (legacy === 'dark') shouldBeDark = true
  else shouldBeDark = systemPrefersDark

  if (shouldBeDark) {
    document.documentElement.classList.add('dark')
  }

  const storedPackId = window.localStorage.getItem('campinity:themePack')
  if (storedPackId) {
    const pack = getThemeById(storedPackId)
    document.documentElement.setAttribute('data-theme-pack', pack.id)
    if (pack.id !== 'default' && pack.tokens) {
      Object.entries(pack.tokens).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--theme-${key}`, value)
      })
    }
  }
} catch {
  // Storage unavailable — defaults to system preference for this load.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <PostsProvider>
          <PostingStatusProvider>
            <App />
          </PostingStatusProvider>
        </PostsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
