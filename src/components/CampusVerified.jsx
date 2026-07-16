import { motion } from 'framer-motion'
import Container from './Container.jsx'
import SectionHeading from './SectionHeading.jsx'
import Icon from './Icon.jsx'

const ease = [0.16, 1, 0.3, 1]

export default function CampusVerified() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          align="center"
          eyebrow="Campus verified"
          title="A feed built for campus, not the internet."
          description="Achievements, questions, club updates and lost & found — everything your campus is talking about, from people you actually know."
          className="max-w-2xl"
        />

        <div className="mt-12 grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease }}
            className="rounded-xl2 border border-line bg-surface p-5 shadow-card"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent-tint flex items-center justify-center font-mono text-2xs font-semibold text-accent">
                AR
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                  Ananya Rao
                  <Icon name="shield" className="w-3 h-3 text-accent" strokeWidth={2} />
                </p>
                <p className="text-2xs text-ink-faint font-mono">CS · FY B</p>
              </div>
              <span className="ml-auto rounded-full bg-accent-tint text-accent text-2xs font-semibold px-2.5 py-1">
                Achievement
              </span>
            </div>
            <p className="mt-4 text-[13.5px] text-ink-soft leading-relaxed">
              Selected for a summer internship at a fintech startup — grateful
              to the placement cell for every prep session.
            </p>
            <div className="mt-4 flex items-center gap-4 text-ink-faint">
              <span className="flex items-center gap-1.5 text-2xs">
                <Icon name="heart" className="w-3.5 h-3.5" strokeWidth={1.7} />
                128
              </span>
              <span className="flex items-center gap-1.5 text-2xs">
                <Icon name="users" className="w-3.5 h-3.5" strokeWidth={1.7} />
                24 replies
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.08, ease }}
            className="rounded-xl2 border border-line bg-surface p-5 shadow-card"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">Notes hub</span>
              <Icon name="book" className="w-4 h-4 text-accent" strokeWidth={1.7} />
            </div>
            <h3 className="mt-3 font-display font-semibold text-[15px]">
              OS Scheduling Algorithms — Complete
            </h3>
            <p className="mt-1 text-[12.5px] text-ink-faint">26 pages · Operating Systems</p>
            <div className="mt-4 h-px bg-lineSoft" />
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-ink-soft">
              <span className="flex items-center gap-1.5">
                <Icon name="heart" className="w-3.5 h-3.5" strokeWidth={1.7} />
                Liked by classmates
              </span>
              <span className="font-semibold text-accent">Download</span>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
