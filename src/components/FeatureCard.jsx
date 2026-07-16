import { motion } from 'framer-motion'
import Icon from './Icon.jsx'

export default function FeatureCard({ title, description, icon, index = 0, featured = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={`group rounded-xl2 border border-line bg-surface p-5 sm:p-6 shadow-card hover:shadow-cardHover hover:border-accent/25 transition-[box-shadow,border-color] duration-300 ${
        featured ? 'sm:col-span-2' : ''
      }`}
      style={{ willChange: 'transform' }}
    >
      {icon && (
        <div className="w-10 h-10 rounded-lg bg-accent-tint flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-white text-accent transition-colors duration-300">
          <Icon name={icon} className="w-5 h-5" />
        </div>
      )}
      <h3 className="font-display font-semibold text-[15px] sm:text-base text-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] sm:text-sm leading-relaxed text-ink-soft">{description}</p>
    </motion.div>
  )
}
