import { useMemo } from 'react'

/**
 * Reusable floating particle field. Deterministic placement (a simple
 * numeric formula, not Math.random) so the layout is reproducible, not
 * a generated-per-render random scatter.
 */
export default function FloatingParticles({ count = 24, className = '' }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        top: `${(i * 41) % 100}%`,
        left: `${(i * 67) % 100}%`,
        size: 1.5 + (i % 3) * 0.7,
        duration: 8 + (i % 10),
        delay: +(((i * 7) % 50) / 10).toFixed(1)
      })),
    [count]
  )

  return (
    <div className={`chp-particles ${className}`.trim()} aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="chp-particle"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            '--chp-duration': `${p.duration}s`,
            '--chp-delay': `${p.delay}s`
          }}
        />
      ))}
    </div>
  )
}