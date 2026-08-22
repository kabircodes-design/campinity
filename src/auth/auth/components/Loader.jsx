import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'

const sizes = {
  sm: 'w-4 h-4 border-[2px]',
  md: 'w-5 h-5 border-[2px]',
  lg: 'w-8 h-8 border-[3px]'
}

export default function Loader({ size = 'md', tone = 'light', className = '' }) {
  const reduced = useReducedMotion()
  const toneClass = tone === 'light' ? 'border-white/30 border-t-white' : 'border-line border-t-accent'

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
