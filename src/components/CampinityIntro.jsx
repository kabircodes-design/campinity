import { useEffect, useState } from 'react'
import Logo from './Logo.jsx'
import { prefersReducedMotion } from '../onboarding/campusIntroFlag.js'

/**
 * The one-time "welcome to your campus" moment shown immediately after
 * onboarding completes (CreateProfilePage.jsx), before HomePage.jsx's
 * own entrance stagger takes over. Pure CSS keyframes + timers — no
 * animation library, nothing that can hang: `onComplete` is gated by a
 * single setTimeout chain with no network/async work anywhere in it, so
 * it always fires and the user always reaches Home.
 *
 * Reduced motion: the global `prefers-reduced-motion` rule in index.css
 * already collapses every keyframe here to ~0ms, so nothing visually
 * "sticks" — but the JS timer durations below are shortened too, so a
 * reduced-motion user isn't forced to sit through a pointless multi-
 * second pause waiting for animations they can't see anyway.
 */
export default function CampinityIntro({ campusName, onComplete }) {
  const reduced = prefersReducedMotion()
  const [textPhase, setTextPhase] = useState('first')
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const textSwapMs = reduced ? 250 : 1100
    const exitStartMs = reduced ? 450 : 1900
    const exitDurationMs = reduced ? 150 : 400

    const timers = [
      window.setTimeout(() => setTextPhase('second'), textSwapMs),
      window.setTimeout(() => setExiting(true), exitStartMs),
      window.setTimeout(() => onComplete?.(), exitStartMs + exitDurationMs)
    ]

    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const secondLine = campusName ? `Welcome to ${campusName}` : 'Your campus. Your people. Your world.'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(120deg, #eaf3ff 0%, #dcecff 45%, #e7f7f7 100%)',
        animation: exiting ? 'campinity-curtain-out 0.4s ease-in both' : undefined
      }}
      role="status"
      aria-live="polite"
      aria-label="Welcome to Campinity"
    >
      <div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)',
          animation: 'campinity-ripple 1.6s ease-out 0.35s both'
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center px-6 text-center">
        <div style={{ animation: 'campinity-logo-in 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
          <Logo className="w-16 h-16" forceLight />
        </div>

        <div className="mt-5 h-6 relative w-full max-w-xs">
          {textPhase === 'first' ? (
            <p
              key="first"
              className="absolute inset-x-0 text-[15px] font-semibold text-gray-700"
              style={{ animation: 'campinity-text-in 0.5s ease-out 0.25s both' }}
            >
              Welcome to Campinity
            </p>
          ) : (
            <p
              key="second"
              className="absolute inset-x-0 text-[15px] font-semibold text-gray-700"
              style={{ animation: 'campinity-text-in 0.5s ease-out both' }}
            >
              {secondLine}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
