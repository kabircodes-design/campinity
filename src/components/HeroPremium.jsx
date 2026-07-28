import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Container from './Container.jsx'
import Icon from './Icon.jsx'
import AnimatedBackgroundPremium from './AnimatedBackgroundPremium.jsx'
import CampusMascotPremium from './CampusMascotPremium.jsx'
import GlassCard from './GlassCard.jsx'
import '../styles/HeroPremium.css'

const ease = [0.16, 1, 0.3, 1]

const TRUST_BADGES = [
  { icon: 'users', label: 'Verified Students' },
  { icon: 'shield', label: 'Privacy First' },
  { icon: 'cap', label: 'Built for Campus Life' }
]

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  )
}

/**
 * Standalone premium Hero — entirely new component tree, does not
 * import or modify Hero.jsx / AnimatedBackground.jsx /
 * CampusMascot.jsx / Nav.jsx / Logo.jsx. Reuses only the existing,
 * already-verified-safe structural components (Container, Icon).
 *
 * Not wired into LandingPage.jsx — swap it in by replacing
 * `import Hero from './Hero.jsx'` with
 * `import Hero from './HeroPremium.jsx'` there when ready.
 */
export default function HeroPremium() {
  return (
    <section
      id="top"
      className="chp-hero relative pt-28 pb-20 sm:pt-40 sm:pb-28 overflow-hidden"
    >
      <AnimatedBackgroundPremium />

      <Container className="relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-10 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="flex justify-center lg:justify-start"
            >
              <GlassCard className="chp-badge inline-flex items-center gap-2 px-3.5 py-1.5">
                <Icon name="shield" className="w-3.5 h-3.5 text-[#7fb2ff]" strokeWidth={1.8} />
                <span className="font-mono text-2xs uppercase tracking-[0.12em] text-white/75">
                  The operating system for college campuses
                </span>
              </GlassCard>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.1, ease }}
              className="mt-7 font-display font-extrabold text-balance text-[2.75rem] leading-[1.05] sm:text-6xl sm:leading-[1.03] lg:text-[4.6rem] text-white"
            >
              Everything campus.
              <br />
              <span className="chp-gradient-text">One app.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease }}
              className="mt-6 text-[15px] sm:text-lg leading-relaxed text-white/65 max-w-md sm:max-w-xl mx-auto lg:mx-0 text-balance"
            >
              Connect, collaborate and grow — all in one verified, privacy-first
              platform built for real campus life.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease }}
              className="mt-9 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3"
            >
              <Link
                to="/login"
                aria-label="Join your campus — go to sign up"
                className="chp-cta-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold px-7 py-3.5 transition-transform duration-200 active:scale-[0.98]"
              >
                Join your campus
                <Icon name="arrow" className="w-4 h-4" />
              </Link>
              <a
                href="#product"
                aria-label="See how Campinity works"
                className="chp-cta-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold px-7 py-3.5 transition-all duration-200 active:scale-[0.98]"
              >
                <span className="chp-cta-secondary__glyph">
                  <PlayGlyph />
                </span>
                See how it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease }}
              className="mt-10"
            >
              <GlassCard className="chp-trust-panel grid grid-cols-3 gap-4 sm:gap-6 px-5 py-5 sm:px-7 sm:py-6 text-left">
                {TRUST_BADGES.map((badge) => (
                  <div key={badge.label} className="flex flex-col gap-2">
                    <Icon name={badge.icon} className="w-5 h-5 text-[#7fb2ff]" strokeWidth={1.7} />
                    <span className="text-[13px] sm:text-sm font-semibold text-white leading-snug">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </GlassCard>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.25, ease }}
            className="flex justify-center"
          >
            <CampusMascotPremium />
          </motion.div>
        </div>
      </Container>
    </section>
  )
}