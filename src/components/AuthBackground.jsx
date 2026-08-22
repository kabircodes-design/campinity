import { useMemo } from 'react'
import BackgroundLayer from './BackgroundLayer.jsx'
import { BACKGROUND_THEMES } from '../data/backgroundThemes.js'

/**
 * A dedicated background for the pre-auth pages (Login/Signup) — always
 * dark, glassmorphism-oriented, with blurred gradient light blobs and
 * soft animated connection lines, distinct from AnimatedBackground.jsx
 * (which is theme-aware and used for Landing/general pages).
 *
 * Deliberately fixed-dark regardless of the app's Light/Dark/System
 * setting: nobody has a theme preference loaded or relevant yet at the
 * point they're looking at a login form.
 *
 * Reuses backgroundThemes.js's login/signup element lists (one source
 * of truth for floating-icon layout) rather than hand-writing a second
 * list just for this component.
 *
 * variant: 'login' | 'signup'.
 */
export default function AuthBackground({ variant = 'login' }) {
  const elements = useMemo(() => {
    const themeConfig = BACKGROUND_THEMES.default
    return themeConfig[variant] || themeConfig.login
  }, [variant])

  return (
    <div className="campus-auth-background" aria-hidden="true">
      <div className="campus-auth-gradient-base" />

      <span className="campus-auth-blob campus-auth-blob-1" />
      <span className="campus-auth-blob campus-auth-blob-2" />
      <span className="campus-auth-blob campus-auth-blob-3" />

      <svg className="campus-auth-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="12" y1="20" x2="38" y2="42" className="campus-connection-line" style={{ '--line-delay': '0s' }} />
        <line x1="70" y1="15" x2="55" y2="38" className="campus-connection-line" style={{ '--line-delay': '2s' }} />
        <line x1="80" y1="70" x2="60" y2="55" className="campus-connection-line" style={{ '--line-delay': '4s' }} />
        <line x1="20" y1="75" x2="42" y2="60" className="campus-connection-line" style={{ '--line-delay': '1s' }} />
        <line x1="45" y1="10" x2="50" y2="30" className="campus-connection-line" style={{ '--line-delay': '3s' }} />
      </svg>

      <div className="campus-auth-background-inner">
        <BackgroundLayer elements={elements} particleCount={variant === 'signup' ? 10 : 8} />
      </div>
    </div>
  )
}