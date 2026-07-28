/**
 * Reusable rotating glow ring. Used by both AnimatedBackgroundPremium
 * and CampusMascotPremium so the "orbiting ring of light" motif is one
 * implementation, not two.
 */
export default function GlowRing({ size = 320, duration = 40, reverse = false, opacity = 0.25, className = '' }) {
  return (
    <span
      className={`chp-glow-ring ${className}`.trim()}
      style={{
        width: size,
        height: size,
        '--chp-ring-duration': `${duration}s`,
        '--chp-ring-direction': reverse ? 'reverse' : 'normal',
        '--chp-ring-opacity': opacity
      }}
      aria-hidden="true"
    />
  )
}
