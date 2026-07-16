import { motion } from 'framer-motion'
import Container from './Container.jsx'
import Icon from './Icon.jsx'
import RadarSignature from './RadarSignature.jsx'

const ease = [0.16, 1, 0.3, 1]

export default function Hero() {
  return (
    <section id="top" className="relative pt-28 pb-16 sm:pt-40 sm:pb-24 overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-accent-tint blur-3xl opacity-70"
        aria-hidden="true"
      />

      <Container className="relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 backdrop-blur px-3.5 py-1.5">
            <Icon name="shield" className="w-3.5 h-3.5 text-accent" strokeWidth={1.8} />
            <span className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-soft">
              The operating system for college campuses
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease }}
          className="mt-7 text-center font-display font-extrabold text-balance text-[2.6rem] leading-[1.06] sm:text-6xl sm:leading-[1.04] lg:text-[4.5rem]"
        >
          Everything campus.
          <br />
          <span className="text-accent">One app.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease }}
          className="mt-6 text-center text-[15px] sm:text-lg leading-relaxed text-ink-soft max-w-md sm:max-w-xl mx-auto text-balance"
        >
          Find classmates, share notes, discover events, join clubs and land
          internships — every profile verified, privacy always first.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease }}
          className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <a
            href="#cta"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-ink text-white text-[15px] font-semibold px-7 py-3.5 hover:bg-accent-deep active:scale-[0.98] transition-all duration-200"
          >
            Join your campus
            <Icon name="arrow" className="w-4 h-4" />
          </a>
          <a
            href="#product"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface text-ink text-[15px] font-semibold px-7 py-3.5 hover:border-ink/30 active:scale-[0.98] transition-all duration-200"
          >
            See what's inside
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease }}
          className="mt-16 sm:mt-20"
        >
          <RadarSignature />
          <p className="mt-6 text-center font-mono text-2xs uppercase tracking-[0.12em] text-ink-faint">
            Campus radar — visible only when you both say yes
          </p>
        </motion.div>
      </Container>
    </section>
  )
}
