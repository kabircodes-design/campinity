import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Container from './Container.jsx'
import SectionHeading from './SectionHeading.jsx'
import FeatureCard from './FeatureCard.jsx'
import Icon from './Icon.jsx'
import { primaryFeatures, secondaryFeatures } from '../data/features.js'

export default function FeatureGrid() {
  const [expanded, setExpanded] = useState(false)

  return (
    <section id="product" className="py-20 sm:py-28 theme-section-glow">
      <Container>
        <SectionHeading
          eyebrow="One app, everything campus"
          title="Not one feature. The whole operating system."
          description="Eighteen tools for campus life, built so they work together instead of eighteen separate apps fighting for your attention."
        />

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {primaryFeatures.map((feature, i) => (
            <FeatureCard key={feature.id} index={i} {...feature} />
          ))}
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {secondaryFeatures.map((feature, i) => (
                  <FeatureCard key={feature.id} index={i} {...feature} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-9 flex justify-center">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border theme-border px-5 py-2.5 text-sm font-semibold theme-text-primary hover:theme-accent transition-colors duration-200"
          >
            {expanded ? 'Show less' : `Show all ${primaryFeatures.length + secondaryFeatures.length} tools`}
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <Icon name="chevronDown" className="w-4 h-4" />
            </motion.span>
          </button>
        </div>
      </Container>
    </section>
  )
}
