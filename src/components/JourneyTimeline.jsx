import { motion } from 'framer-motion'
import Container from './Container.jsx'
import SectionHeading from './SectionHeading.jsx'
import Icon from './Icon.jsx'
import { journeySteps } from '../data/journey.js'

export default function JourneyTimeline() {
  return (
    <section id="journey" className="py-20 sm:py-28 theme-bg-surface border-y theme-divider theme-section-glow">
      <Container>
        <SectionHeading
          eyebrow="Why Campinity"
          title="Built for every stage of college — in order."
          description="From orientation week to graduation day, one thread runs through your whole degree instead of a new app for every stage."
        />

        <div className="mt-12 relative">
          <div
            className="absolute left-[19px] top-2 bottom-2 w-px sm:left-1/2"
            style={{ backgroundColor: 'var(--theme-border)' }}
            aria-hidden="true"
          />

          <ol className="space-y-8 sm:space-y-0">
            {journeySteps.map((step, i) => {
              const isLeft = i % 2 === 0
              return (
                <li key={step.id} className="sm:grid sm:grid-cols-2 sm:gap-10 sm:py-6">
                  <div className={`hidden sm:block ${isLeft ? '' : 'order-2'}`}>
                    {isLeft && <StepCard step={step} index={i} align="right" />}
                  </div>
                  <div className={`hidden sm:block ${isLeft ? 'order-2' : ''}`}>
                    {!isLeft && <StepCard step={step} index={i} align="left" />}
                  </div>

                  <div className="sm:hidden">
                    <StepCard step={step} index={i} align="left" mobile />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </Container>
    </section>
  )
}

function StepCard({ step, index, align, mobile = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: mobile ? 0 : align === 'left' ? -16 : 16, y: mobile ? 12 : 0 }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex gap-4 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : ''}`}
    >
      <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full theme-bg-surface border-2 flex items-center justify-center theme-accent" style={{ borderColor: 'var(--theme-accent)' }}>
        <Icon name={step.icon} className="w-[18px] h-[18px]" strokeWidth={1.7} />
      </div>
      <div className="pt-1">
        <span className="font-mono text-2xs theme-text-muted tracking-[0.1em]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="font-display font-semibold text-[15px] sm:text-base mt-0.5 theme-text-primary">{step.title}</h3>
        <p className="mt-1 text-[13.5px] sm:text-sm theme-text-secondary leading-relaxed max-w-xs">
          {step.description}
        </p>
      </div>
    </motion.div>
  )
}
