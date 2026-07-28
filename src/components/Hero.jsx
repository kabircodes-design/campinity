import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Container from './Container.jsx'
import Icon from './Icon.jsx'
import AnimatedBackground from './AnimatedBackground.jsx'
import CampusMascot from './CampusMascot.jsx'

const ease = [0.16, 1, 0.3, 1]

const TRUST_BADGES = [
  { label: 'Verified students only' },
  { label: 'Privacy-first by design' },
  { label: 'Built for campus life' }
]

export default function Hero() {
  return (
    <section id="top" className="relative pt-28 pb-16 sm:pt-40 sm:pb-24 overflow-hidden">
      <AnimatedBackground variant="landing" />

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="flex justify-center lg:justify-start"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur px-3.5 py-1.5">
                <Icon name="shield" className="w-3.5 h-3.5 text-accent" strokeWidth={1.8} />
                <span className="font-mono text-2xs uppercase tracking-[0.12em] text-white/70">
                  The operating system for college campuses
                </span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
              className="mt-7 font-display font-extrabold text-balance text-[2.6rem] leading-[1.06] sm:text-6xl sm:leading-[1.04] lg:text-[4.5rem] text-white"
            >
              Everything campus.
              <br />
              <span className="text-accent">One app.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease }}
              className="mt-6 text-[15px] sm:text-lg leading-relaxed text-white/70 max-w-md sm:max-w-xl mx-auto lg:mx-0 text-balance"
            >
              Find classmates, share notes, discover events, join clubs and land
              internships — every profile verified, privacy always first.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease }}
              className="mt-9 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
            >
              <Link
                to="/login"
                className="campus-cta-magnetic w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white text-ink text-[15px] font-semibold px-7 py-3.5 hover:bg-white/90 active:scale-[0.98] transition-all duration-200"
              >
                Join your campus
                <Icon name="arrow" className="w-4 h-4" />
              </Link>
              <a
                href="#product"
                className="campus-cta-magnetic w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 text-white text-[15px] font-semibold px-7 py-3.5 hover:bg-white/10 hover:border-white/30 active:scale-[0.98] transition-all duration-200"
              >
                See what's inside
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32, ease }}
              className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2.5"
            >
              {TRUST_BADGES.map((badge) => (
                <div key={badge.label} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                  <span className="text-[13px] text-white/60">{badge.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease }}
            className="flex justify-center"
          >
            <CampusMascot />
          </motion.div>
        </div>
      </Container>
    </section>
  )
}