import { useEffect, useState } from 'react'
import FloatingParticles from './FloatingParticles.jsx'
import GlowRing from './GlowRing.jsx'

function getViewportTier() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

/**
 * Premium ambient background for HeroPremium — gradient base, glow
 * rings, floating particles, a handful of twinkling stars.
 *
 * Continuous ambient loops here are CSS-driven (cheaper for many
 * simultaneous infinite animations than a JS-driven approach); Framer
 * Motion is reserved for HeroPremium's discrete entrance animations —
 * this matches how the rest of this codebase already splits the two.
 *
 * Always `position: absolute; inset: 0; pointer-events: none; z-index: 0`
 * — the host section needs `position: relative` and its real content in
 * a higher stacking context (e.g. `relative z-10`).
 */
export default function AnimatedBackgroundPremium() {
  const [tier, setTier] = useState(getViewportTier)

  useEffect(() => {
    const onResize = () => setTier(getViewportTier())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const particleCount = tier === 'mobile' ? 8 : tier === 'tablet' ? 16 : 26
  const starCount = tier === 'mobile' ? 4 : tier === 'tablet' ? 6 : 9

  const stars = Array.from({ length: starCount }).map((_, i) => ({
    id: i,
    top: `${(i * 29) % 100}%`,
    left: `${(i * 53) % 100}%`,
    delay: +(((i * 11) % 40) / 10).toFixed(1)
  }))

  return (
    <div className="chp-bg" aria-hidden="true">
      <div className="chp-bg__gradient" />
      <div className="chp-bg__vignette" />

      {tier !== 'mobile' && (
        <>
          <GlowRing size={520} duration={70} opacity={0.14} className="chp-bg__ring chp-bg__ring--1" />
          <GlowRing size={380} duration={54} reverse opacity={0.1} className="chp-bg__ring chp-bg__ring--2" />
        </>
      )}

      <FloatingParticles count={particleCount} />

      {stars.map((star) => (
        <span
          key={star.id}
          className="chp-star"
          style={{ top: star.top, left: star.left, '--chp-delay': `${star.delay}s` }}
        />
      ))}
    </div>
  )
}