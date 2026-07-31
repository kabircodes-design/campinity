import { motion } from 'framer-motion'
import { useTheme } from '../theme/useTheme.js'

/**
 * Premium Sun/Moon theme toggle. Cycles light -> dark -> light on
 * click (system mode isn't reachable from this control — it's a
 * two-state visual switch; system preference is still respected as
 * the *initial* value the first time a visitor arrives with no saved
 * preference, via ThemeProvider's own getInitialMode()).
 *
 * Sun and Moon are drawn as a single SVG whose rays/craters cross-fade
 * and whose disc morphs via a shared layoutId-less transform (no
 * separate icon components, no emoji) — Framer Motion drives the
 * spring, CSS/SVG owns the shape.
 */
export default function ThemeToggle({ className = '' }) {
  const { mode, resolvedIsDark, setMode } = useTheme()

  const handleToggle = () => {
    setMode(resolvedIsDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={resolvedIsDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-pressed={resolvedIsDark}
      title={mode === 'system' ? `System (currently ${resolvedIsDark ? 'dark' : 'light'})` : undefined}
      className={`chp-theme-toggle ${className}`.trim()}
    >
      <motion.span
        className="chp-theme-toggle__track"
        animate={{
          backgroundColor: resolvedIsDark ? 'rgba(37, 99, 235, 0.9)' : 'rgba(226, 232, 240, 0.9)'
        }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.span
          className="chp-theme-toggle__thumb"
          animate={{ x: resolvedIsDark ? 20 : 2, rotate: resolvedIsDark ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            {resolvedIsDark ? (
              <path
                d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"
                fill="#0b1220"
              />
            ) : (
              <g fill="#f59e0b">
                <circle cx="12" cy="12" r="4.5" />
                <g stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="12" y1="2.5" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="21.5" />
                  <line x1="2.5" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="21.5" y2="12" />
                  <line x1="4.9" y1="4.9" x2="6.6" y2="6.6" />
                  <line x1="17.4" y1="17.4" x2="19.1" y2="19.1" />
                  <line x1="4.9" y1="19.1" x2="6.6" y2="17.4" />
                  <line x1="17.4" y1="6.6" x2="19.1" y2="4.9" />
                </g>
              </g>
            )}
          </svg>
        </motion.span>
      </motion.span>
    </button>
  )
}
