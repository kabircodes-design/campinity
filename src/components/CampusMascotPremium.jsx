import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import GlowRing from './GlowRing.jsx'

/**
 * Campinity's premium mascot — an original floating glass orb
 * companion. Deliberately NOT a rounded-square "screen head" shape —
 * that silhouette belongs to the reference image this was inspired by,
 * not copied from. A single smooth glass orb with two soft glowing
 * eyes and a curved glow-smile embedded directly in its core, rather
 * than a separate flat screen element.
 */
export default function CampusMascotPremium({ className = '' }) {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer = null

    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 2400
      timer = window.setTimeout(() => {
        if (cancelled) return
        setBlinking(true)
        window.setTimeout(() => {
          if (!cancelled) setBlinking(false)
        }, 150)
        scheduleBlink()
      }, delay)
    }

    scheduleBlink()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  return (
    <motion.div
      className={`chp-mascot ${className}`.trim()}
      role="img"
      aria-label="Campinity's AI campus companion"
      animate={{ y: [0, -16, 0], rotate: [-1.5, 1.5, -1.5] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    >
      <GlowRing size={340} duration={46} opacity={0.3} className="chp-mascot__ring chp-mascot__ring--1" />
      <GlowRing size={280} duration={60} reverse opacity={0.22} className="chp-mascot__ring chp-mascot__ring--2" />
      <span className="chp-mascot__ground-glow" />

      <div className="chp-mascot__orb">
        <span className="chp-mascot__sheen" />
        <span className="chp-mascot__core">
          <span className={`chp-mascot__eyes ${blinking ? 'chp-mascot__eyes--blink' : ''}`}>
            <span className="chp-mascot__eye" />
            <span className="chp-mascot__eye" />
          </span>
          <span className="chp-mascot__smile" />
        </span>
      </div>

      <span className="chp-mascot__shadow" />
    </motion.div>
  )
}