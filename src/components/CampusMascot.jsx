import { useEffect, useState } from 'react'

/**
 * Campinity's floating AI Campus Companion — the hero section's own
 * mascot, in place of a phone/device mockup. Fully self-contained SVG +
 * CSS animation (irregular blink via a scheduled timeout, slow float,
 * gentle rotation, breathing glow, rotating light rings). No external
 * asset, no animation library.
 *
 * Styles live in src/styles/CampusBackground.css (.campus-mascot*).
 */
export default function CampusMascot({ className = '' }) {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    let cancelled = false
    let blinkTimer = null

    const scheduleBlink = () => {
      const delay = 3200 + Math.random() * 2600
      blinkTimer = window.setTimeout(() => {
        if (cancelled) return
        setBlinking(true)
        window.setTimeout(() => {
          if (!cancelled) setBlinking(false)
        }, 160)
        scheduleBlink()
      }, delay)
    }

    scheduleBlink()
    return () => {
      cancelled = true
      if (blinkTimer) window.clearTimeout(blinkTimer)
    }
  }, [])

  return (
    <div className={`campus-mascot ${className}`.trim()} aria-hidden="true">
      <span className="campus-mascot__glow" />
      <span className="campus-mascot__ring campus-mascot__ring--1" />
      <span className="campus-mascot__ring campus-mascot__ring--2" />

      <div className="campus-mascot__body">
        <svg viewBox="0 0 160 160" className="campus-mascot__svg">
          <defs>
            <linearGradient id="campus-mascot-body" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f1f5fb" />
              <stop offset="100%" stopColor="#dbe6f5" />
            </linearGradient>
            <radialGradient id="campus-mascot-highlight" cx="35%" cy="25%" r="45%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>

          <path
            d="M80 8C118 8 146 34 150 70C153 98 140 122 116 138C96 151 64 151 44 138C20 122 7 98 10 70C14 34 42 8 80 8Z"
            fill="url(#campus-mascot-body)"
          />
          <path
            d="M80 8C118 8 146 34 150 70C153 98 140 122 116 138C96 151 64 151 44 138C20 122 7 98 10 70C14 34 42 8 80 8Z"
            fill="url(#campus-mascot-highlight)"
          />

          <g className={`campus-mascot__eyes ${blinking ? 'campus-mascot__eyes--blink' : ''}`}>
            <rect x="56" y="66" width="12" height="18" rx="6" fill="#1d4ed8" />
            <rect x="92" y="66" width="12" height="18" rx="6" fill="#1d4ed8" />
          </g>

          <path
            className="campus-mascot__smile"
            d="M64 100C70 108 90 108 96 100"
            stroke="#1d4ed8"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  )
}