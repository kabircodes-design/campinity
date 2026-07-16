import { motion } from 'framer-motion'
import Container from './Container.jsx'
import SectionHeading from './SectionHeading.jsx'
import Icon from './Icon.jsx'
import { events } from '../data/events.js'

export default function EventsShowcase() {
  return (
    <section id="events" className="py-20 sm:py-28 bg-surface border-y border-lineSoft">
      <Container className="!px-0 sm:!px-8 lg:!px-10">
        <div className="px-5 sm:px-0">
          <SectionHeading
            eyebrow="Never miss a moment"
            title="Every campus event, in one feed."
            description="Fests, hackathons, workshops and placement drives — discover what's happening, RSVP, and never miss what matters."
          />
        </div>

        <div className="mt-10 flex gap-4 overflow-x-auto scroll-hidden snap-x snap-mandatory px-5 sm:px-0 pb-2">
          {events.map((event, i) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="snap-start flex-shrink-0 w-[260px] sm:w-[280px] rounded-xl2 border border-line bg-bg overflow-hidden shadow-card"
            >
              <div className={`h-28 bg-gradient-to-br ${event.gradient} flex items-end p-4`}>
                <span className="rounded-full bg-white/20 backdrop-blur text-white text-2xs font-medium px-3 py-1">
                  {event.org}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display font-semibold text-[15px]">{event.title}</h3>
                <div className="mt-2.5 space-y-1.5">
                  <p className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                    <Icon name="calendar" className="w-3.5 h-3.5" strokeWidth={1.7} />
                    {event.date} · {event.time}
                  </p>
                  <p className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
                    <Icon name="radar" className="w-3.5 h-3.5" strokeWidth={1.7} />
                    {event.location}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}

          <div className="flex-shrink-0 w-1" aria-hidden="true" />
        </div>

        <p className="mt-4 px-5 sm:px-0 font-mono text-2xs text-ink-faint uppercase tracking-[0.1em]">
          Swipe to explore →
        </p>
      </Container>
    </section>
  )
}
