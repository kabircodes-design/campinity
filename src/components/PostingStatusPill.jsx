import { useEffect, useState } from 'react'
import { usePostingStatus } from '../context/PostingStatusContext.jsx'
import '../styles/PostingStatusPill.css'

/**
 * The signature Campinity posting-status pill. Pure CSS-driven (no
 * new animation library, per explicit instruction) — a rotating blue
 * gradient arc around a ring with a small "+" mark inside while
 * posting, transitioning to a self-drawing checkmark + soft pulse on
 * success, then a slide/fade exit. All motion is transform/opacity
 * only (per the brief's own explicit list of what NOT to animate:
 * width, height, box-shadow, filter — none of those are touched
 * here), and prefers-reduced-motion collapses the continuous rotation
 * to a simple static/fade state.
 *
 * Rendered once, in HomePage.jsx, sitting outside the normal document
 * flow (fixed positioning) so it never affects layout regardless of
 * which Home tab/state is showing.
 */
export default function PostingStatusPill() {
  const { status, message, reset } = usePostingStatus()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false)
      return undefined
    }
    setVisible(true)
    setExiting(false)

    if (status === 'success') {
      // Success sequence: ~600ms of checkmark/pulse, then a further
      // ~1400ms holding "Posted" so it's actually readable, then exit.
      const holdTimer = window.setTimeout(() => setExiting(true), 1600)
      const clearTimer = window.setTimeout(() => {
        setVisible(false)
        reset()
      }, 1600 + 350)
      return () => {
        window.clearTimeout(holdTimer)
        window.clearTimeout(clearTimer)
      }
    }

    return undefined
  }, [status, reset])

  const handleRetryDismiss = () => {
    setExiting(true)
    window.setTimeout(() => {
      setVisible(false)
      reset()
    }, 350)
  }

  if (!visible) return null

  return (
    <div
      className={`cps-pill-wrap ${exiting ? 'cps-pill-wrap--exit' : 'cps-pill-wrap--enter'}`}
      role="status"
      aria-live="polite"
    >
      <div className={`cps-pill cps-pill--${status}`}>
        {status === 'posting' && (
          <span className="cps-ring" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="cps-ring__svg">
              <circle cx="12" cy="12" r="9.5" className="cps-ring__track" />
              <circle cx="12" cy="12" r="9.5" className="cps-ring__arc" />
            </svg>
            <span className="cps-ring__mark">+</span>
          </span>
        )}

        {status === 'success' && (
          <span className="cps-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="cps-check__svg">
              <circle cx="12" cy="12" r="9.5" className="cps-check__circle" />
              <path d="M7.5 12.5l3 3 6-6.5" className="cps-check__mark" />
            </svg>
          </span>
        )}

        {status === 'error' && (
          <span className="cps-error-icon" aria-hidden="true">!</span>
        )}

        <span className="cps-pill__text">{message}</span>

        {status === 'error' && (
          <button type="button" className="cps-pill__retry" onClick={handleRetryDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
