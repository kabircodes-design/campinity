import { motion } from 'framer-motion'
import Container from './Container.jsx'
import Icon from './Icon.jsx'

export default function CTA() {
  return (
    <section id="cta" className="py-20 sm:py-28">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-xl3 bg-ink px-6 py-14 sm:px-16 sm:py-20 text-center"
        >
          <div
            className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-accent/25 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -top-16 -left-16 w-64 h-64 rounded-full bg-accent/15 blur-3xl"
            aria-hidden="true"
          />

          <p className="eyebrow !text-accent-glow mb-3">Modern student experience</p>
          <h2 className="relative font-display font-bold text-white text-[1.9rem] leading-[1.15] sm:text-4xl sm:leading-[1.15] text-balance max-w-lg mx-auto">
            Your campus, finally in one place.
          </h2>
          <p className="relative mt-4 text-white/60 text-[15px] sm:text-base max-w-sm mx-auto leading-relaxed">
            Verified from your first login. Free for every student on campus.
          </p>

          <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white text-ink text-[15px] font-semibold px-7 py-3.5 hover:bg-accent-tint active:scale-[0.98] transition-all duration-200"
            >
              Join your campus
              <Icon name="arrow" className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </Container>
    </section>
  )
}
