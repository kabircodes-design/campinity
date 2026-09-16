import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import App from './App.jsx'
import { PostsProvider } from './hooks/usePosts.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { PostingStatusProvider } from './context/PostingStatusContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
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
    {/* reducedMotion="user" — the one global switch that makes every
        existing framer-motion component (sheets, modals, story viewer,
        radar cards, etc.) automatically honor OS-level "reduce motion",
        the same way index.css's own transition/animation-duration rule
        already does for plain CSS. Framer Motion's animations run via
        the Web Animations API, not CSS transitions, so that CSS rule
        never covered them — this was the one real gap. Purely a motion
        toggle: it does not change component structure, props, or any
        existing animate/exit variant, so nothing else here changes
        behavior. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <PostsProvider>
              <PostingStatusProvider>
                <CallProvider>
                  <App />
                </CallProvider>
              </PostingStatusProvider>
            </PostsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </MotionConfig>
  </React.StrictMode>
)
