import { motion } from 'framer-motion'
import Container from './Container.jsx'
import Icon from './Icon.jsx'

const rows = [
  { label: 'Someone nearby', value: 'FY · CS-B' },
  { label: 'Distance', value: '~100m' },
  { label: 'Verified', value: 'Yes', icon: 'shield' },
  { label: 'Mutual interests', value: 'Photography, Football' }
]

export default function PrivacySection() {
  return (
    <section id="privacy" className="py-20 sm:py-28">
      <Container className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl3 border border-line bg-surface p-6 shadow-card order-2 lg:order-1"
        >
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
              Campus radar
            </span>
            <span className="flex items-center gap-1.5 text-2xs font-mono text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              live
            </span>
          </div>

          <dl className="divide-y divide-lineSoft">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3.5">
                <dt className="text-[13.5px] text-ink-soft">{row.label}</dt>
                <dd className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink text-right">
                  {row.icon && <Icon name={row.icon} className="w-3.5 h-3.5 text-accent" strokeWidth={2} />}
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-full bg-accent-tint text-accent text-[13px] font-semibold text-center py-3">
            Connection request sent ✓
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl2 border border-line px-4 py-3.5">
            <span className="text-[13.5px] font-medium text-ink">Campus Radar</span>
            <span className="w-10 h-6 rounded-full bg-accent relative">
              <span className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow-card" />
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="order-1 lg:order-2"
        >
          <p className="eyebrow mb-3">Privacy first, always</p>
          <h2 className="text-[1.75rem] leading-[1.15] sm:text-4xl sm:leading-[1.12] font-display font-bold text-balance">
            Discoverable only when you both say yes.
          </h2>
          <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-ink-soft max-w-md">
            Campus Radar surfaces nearby verified students — but only when
            both people have switched it on. Off means invisible. On means
            discoverable. You're always the one in control.
          </p>

          <ul className="mt-7 space-y-4">
            {[
              { icon: 'lock', text: 'Mutual opt-in only — one-sided visibility never happens' },
              { icon: 'shield', text: 'Every account behind a profile is a verified student' },
              { icon: 'radar', text: 'Turn it off anytime and disappear from radar instantly' }
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-tint flex items-center justify-center flex-shrink-0 text-accent">
                  <Icon name={item.icon} className="w-4 h-4" strokeWidth={1.8} />
                </div>
                <span className="text-[14.5px] text-ink-soft leading-relaxed pt-1">{item.text}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </Container>
    </section>
  )
}
