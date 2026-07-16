import { motion } from 'framer-motion'

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className = ''
}) {
  const isCenter = align === 'center'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`${isCenter ? 'text-center mx-auto' : ''} max-w-xl ${className}`}
    >
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-[1.75rem] leading-[1.15] sm:text-4xl sm:leading-[1.12] font-display font-bold text-balance">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-ink-soft text-balance">
          {description}
        </p>
      )}
    </motion.div>
  )
}
