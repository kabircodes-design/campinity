import { motion } from 'framer-motion'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

const nodes = [
  { label: 'AS', top: '14%', left: '18%', delay: 0 },
  { label: 'RM', top: '68%', left: '12%', delay: 0.4 },
  { label: 'KJ', top: '22%', left: '78%', delay: 0.8 },
  { label: 'NP', top: '74%', left: '74%', delay: 1.2 }
]

export default function RadarSignature() {
  const reduced = useReducedMotion()

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] sm:max-w-[380px]">
      {/* static concentric guides — no layout cost, pure decoration */}
      <div className="absolute inset-0 rounded-full border border-line" />
      <div className="absolute inset-[15%] rounded-full border border-line" />
      <div className="absolute inset-[30%] rounded-full border border-line" />

      {/* pulsing rings, GPU-accelerated (transform + opacity only) */}
      {!reduced && (
        <>
          <span className="absolute inset-[30%] rounded-full bg-accent/20 animate-ringPulse" />
          <span
            className="absolute inset-[30%] rounded-full bg-accent/20 animate-ringPulse"
            style={{ animationDelay: '1.1s' }}
          />
          <span
            className="absolute inset-[30%] rounded-full bg-accent/20 animate-ringPulse"
            style={{ animationDelay: '2.2s' }}
          />
        </>
      )}

      {/* center dot */}
      <div className="absolute inset-[30%] rounded-full bg-accent-tint flex items-center justify-center">
        <span className="w-3.5 h-3.5 rounded-full bg-accent shadow-[0_0_0_6px_rgba(47,95,255,0.14)]" />
      </div>

      {nodes.map((node) => (
        <motion.div
          key={node.label}
          className="absolute flex items-center justify-center w-11 h-11 rounded-full bg-surface border border-line shadow-card font-mono text-[11px] font-semibold text-ink-soft"
          style={{ top: node.top, left: node.left, willChange: 'transform' }}
          animate={reduced ? {} : { y: [0, -5, 0] }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: node.delay
          }}
        >
          {node.label}
        </motion.div>
      ))}
    </div>
  )
}
