import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'

const sizes = {
  sm: 'w-4 h-4 border-[2px]',
  md: 'w-5 h-5 border-[2px]',
  lg: 'w-8 h-8 border-[3px]'
}

export default function Loader({ size = 'md', tone = 'light', className = '' }) {
  const reduced = useReducedMotion()
  // 'invert' is for buttons whose own background flips with the theme
  // (Button.jsx's primary variant: near-black in light mode, white in
  // dark mode) — the spinner has to flip the opposite way to stay
  // visible against that background in both modes.
  const toneClass =
    tone === 'light'
      ? 'border-white/30 border-t-white'
      : tone === 'invert'
        ? 'border-white/30 border-t-white dark:border-ink/20 dark:border-t-ink'
        : 'border-line border-t-accent dark:border-white/15 dark:border-t-accent'

  return (
    <motion.span
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full ${sizes[size]} ${toneClass} ${className}`}
      style={{ willChange: 'transform' }}
      animate={reduced ? {} : { rotate: 360 }}
      transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
    />
  )
}
