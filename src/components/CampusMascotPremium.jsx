import { motion } from 'framer-motion'
import GlowRing from './GlowRing.jsx'

/**
 * Campinity's mascot — renders the actual mascot artwork
 * (public/mascot.webp, falling back to public/mascot.png) rather than
 * an approximation built from CSS/SVG. The image itself is never
 * modified at runtime: only the wrapper is animated (Framer Motion
 * float + tilt) and a separate inner CSS breathing scale on the <img>
 * itself, kept on a different element than the Framer Motion transform
 * so the two never fight over the same `transform` property.
 *
 * Orbit rings, the aura glow, the ground glow, and the shadow are all
 * still real animated DOM/CSS elements surrounding the image — none of
 * that was baked into the artwork.
 */
export default function CampusMascotPremium({ className = '' }) {
  return (
    <motion.div
      className={`chp-mascot ${className}`.trim()}
      role="img"
      aria-label="Campinity's AI campus companion"
      animate={{ y: [0, -16, 0], rotate: [-2, 2, -2] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
    >
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
  )
}
