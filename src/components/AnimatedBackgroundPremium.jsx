import { useEffect, useRef, useState } from 'react'
import FloatingParticles from './FloatingParticles.jsx'
import GlowRing from './GlowRing.jsx'

function getViewportTier() {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < 640) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event) => setReduced(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])
  return reduced
}

const AI_NODES = [
  { x: 12, y: 22 },
  { x: 28, y: 14 },
  { x: 8, y: 48 },
  { x: 88, y: 30 },
  { x: 72, y: 18 },
  { x: 92, y: 58 }
]
const AI_LINKS = [
  [0, 1],
  [0, 2],
  [3, 4],
  [3, 5]
]

export default function AnimatedBackgroundPremium() {
  const [tier, setTier] = useState(getViewportTier)
  const [paused, setPaused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const rootRef = useRef(null)

  useEffect(() => {
    const onResize = () => setTier(getViewportTier())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const handleVisibility = () => setPaused(document.hidden)
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    if (reducedMotion || tier === 'mobile') return undefined
    let frame = null
    const handleMove = (event) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        const node = rootRef.current
        if (node) {
          const rect = node.getBoundingClientRect()
          node.style.setProperty('--chp-cursor-x', `${event.clientX - rect.left}px`)
          node.style.setProperty('--chp-cursor-y', `${event.clientY - rect.top}px`)
        }
        frame = null
      })
    }
    const host = rootRef.current?.closest('.chp-hero')
    host?.addEventListener('mousemove', handleMove)
    return () => host?.removeEventListener('mousemove', handleMove)
  }, [reducedMotion, tier])

  const particleCount = tier === 'mobile' ? 10 : tier === 'tablet' ? 20 : 34
  const starCount = tier === 'mobile' ? 5 : tier === 'tablet' ? 8 : 12

  const stars = Array.from({ length: starCount }).map((_, i) => ({
    id: i,
    top: `${(i * 29) % 100}%`,
    left: `${(i * 53) % 100}%`,
    delay: +(((i * 11) % 40) / 10).toFixed(1)
  }))

  return (
    <div ref={rootRef} className={`chp-bg ${paused ? 'chp-bg--paused' : ''}`.trim()} aria-hidden="true">
      <div className="chp-bg__gradient" />
      <div className="chp-bg__bloom" />
      {tier !== 'mobile' && !reducedMotion && <div className="chp-bg__cursor-glow" />}
      <div className="chp-bg__vignette" />

      {tier !== 'mobile' && (
        <>
          <GlowRing size={560} duration={75} opacity={0.13} className="chp-bg__ring chp-bg__ring--1" />
          <GlowRing size={420} duration={58} reverse opacity={0.11} className="chp-bg__ring chp-bg__ring--2" />
          <GlowRing size={300} duration={42} opacity={0.09} className="chp-bg__ring chp-bg__ring--3" />
        </>
      )}

      {tier === 'desktop' && (
        <svg className="chp-bg__nodes" viewBox="0 0 100 70" preserveAspectRatio="none">
          {AI_LINKS.map(([a, b], i) => (
            <line
              key={i}
              x1={AI_NODES[a].x}
              y1={AI_NODES[a].y}
              x2={AI_NODES[b].x}
              y2={AI_NODES[b].y}
              className="chp-bg__node-link"
              style={{ '--chp-delay': `${i * 1.3}s` }}
            />
          ))}
          {AI_NODES.map((node, i) => (
            <circle key={i} cx={node.x} cy={node.y} r="0.6" className="chp-bg__node" style={{ '--chp-delay': `${i * 0.7}s` }} />
          ))}
        </svg>
      )}

      <FloatingParticles count={particleCount} />

      {stars.map((star) => (
        <span key={star.id} className="chp-star" style={{ top: star.top, left: star.left, '--chp-delay': `${star.delay}s` }} />
      ))}
    </div>
  )
}
