import { useEffect, useRef, useState } from 'react'
import { motion, useAnimation } from 'framer-motion'
import GlowRing from './GlowRing.jsx'

const GREETED_KEY = 'campinity:mascotGreeted'

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

/**
 * Campinity's mascot — renders the actual mascot artwork unmodified
 * (public/mascot.webp / .png); every behavior below animates the
 * surrounding DOM, never the image itself.
 *
 * Honest limits, because the mascot is a single static raster image
 * with no separate eye/arm layer:
 *  - "looks toward cursor" is approximated as a subtle whole-body tilt
 *    toward the pointer, not literal eye movement.
 *  - "waves" / "celebrates" are approximated with the same quick
 *    scale+rotate pulse (`chp-mascot__interactive`'s reactCue effect) —
 *    there's no separate arm to animate a real wave with.
 *  - "blinks" and "peeks from behind decorative elements" aren't
 *    implemented at all — both need either a second image frame or a
 *    posed variant of the artwork, which "do not modify the mascot
 *    artwork" rules out.
 *
 * Three nested motion layers, each owning a different transform, so
 * none of them fight over the same CSS property:
 *   outer  (.chp-mascot)              — continuous float + gentle sway (unchanged from before)
 *   middle (.chp-mascot__tilt)        — cursor-aware tilt (plain style, not Framer)
 *   inner  (.chp-mascot__interactive) — click-nudge / greet / CTA-react pulses (Framer `controls`)
 */
export default function CampusMascotPremium({ className = '', reactCue = 0, sectionRef }) {
  const reducedMotion = usePrefersReducedMotion()
  const wrapperRef = useRef(null)
  const controls = useAnimation()
  const [tilt, setTilt] = useState(0)
  const [paused, setPaused] = useState(false)

  // Pause the continuous CSS-driven animations when the tab isn't
  // visible — no point spending GPU/battery animating something no one
  // can see.
  useEffect(() => {
    const handleVisibility = () => setPaused(document.hidden)
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Cursor awareness — subtle lean toward the pointer's horizontal
  // position, clamped to a small range so it never reads as jittery.
  useEffect(() => {
    if (reducedMotion) return undefined
    let frame = null
    const handleMove = (event) => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        const node = wrapperRef.current
        if (node) {
          const rect = node.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const dx = (event.clientX - cx) / (window.innerWidth / 2)
          setTilt(Math.max(-1, Math.min(1, dx)) * 5)
        }
        frame = null
      })
    }
    window.addEventListener('mousemove', handleMove)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [reducedMotion])

  // Click awareness — notices a click anywhere in the Hero section,
  // leans toward it, then springs back home.
  useEffect(() => {
    if (reducedMotion) return undefined
    const host = sectionRef?.current
    if (!host) return undefined
    const handleClick = (event) => {
      const node = wrapperRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = Math.max(-1, Math.min(1, (event.clientX - cx) / 320))
      const dy = Math.max(-1, Math.min(1, (event.clientY - cy) / 320))
      controls
        .start({
          x: dx * 16,
          y: dy * 16,
          transition: { type: 'spring', stiffness: 120, damping: 12 }
        })
        .then(() => {
          controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 55, damping: 14 } })
        })
    }
    host.addEventListener('click', handleClick)
    return () => host.removeEventListener('click', handleClick)
  }, [controls, sectionRef, reducedMotion])

  // Greets once — ever, not once per page load — the first time a
  // visitor sees the mascot. A slightly bigger scale pulse, not
  // anything loud.
  useEffect(() => {
    if (reducedMotion) return undefined
    let alreadyGreeted = false
    try {
      alreadyGreeted = window.localStorage.getItem(GREETED_KEY) === 'true'
    } catch {
      alreadyGreeted = false
    }
    if (alreadyGreeted) return undefined

    const timer = window.setTimeout(() => {
      controls.start({ scale: [1, 1.08, 1], transition: { duration: 0.9, ease: 'easeInOut' } })
      try {
        window.localStorage.setItem(GREETED_KEY, 'true')
      } catch {
        // Storage unavailable — greeting just replays next visit, not a functional problem.
      }
    }, 900)
    return () => window.clearTimeout(timer)
  }, [controls, reducedMotion])

  // Reacts when a CTA elsewhere in the Hero is hovered/focused —
  // reactCue is a counter passed down from HeroPremium.jsx, incremented
  // on each hover. Stands in for "react near CTA buttons".
  useEffect(() => {
    if (reactCue === 0 || reducedMotion) return
    controls.start({ scale: [1, 1.06, 1], rotate: [0, 4, 0], transition: { duration: 0.6, ease: 'easeInOut' } })
  }, [reactCue, controls, reducedMotion])

  return (
    <motion.div
      ref={wrapperRef}
      className={`chp-mascot ${className} ${paused ? 'chp-mascot--paused' : ''}`.trim()}
      role="img"
      aria-label="Campinity's AI campus companion"
      animate={reducedMotion ? undefined : { y: [0, -16, 0], rotate: [-2, 2, -2] }}
      transition={reducedMotion ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="chp-mascot__tilt" style={{ transform: `rotate(${tilt}deg)` }}>
        <motion.div animate={controls} className="chp-mascot__interactive">
          <span className="chp-mascot__aura" />
          <GlowRing size={360} duration={48} opacity={0.32} className="chp-mascot__ring chp-mascot__ring--1" />
          <GlowRing size={300} duration={62} reverse opacity={0.24} className="chp-mascot__ring chp-mascot__ring--2" />
          <span className="chp-mascot__ground-glow" />

          <picture>
            <source srcSet="/mascot.webp" type="image/webp" />
            <img
              src="/mascot.png"
              alt="Campinity's AI campus companion — a friendly glowing robot"
              className="chp-mascot__image"
              width={560}
              height={547}
              decoding="async"
            />
          </picture>

          <span className="chp-mascot__shadow" />
        </motion.div>
      </div>
    </motion.div>
  )
}