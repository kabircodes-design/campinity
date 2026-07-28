import Nav from '../components/Nav.jsx'
import Hero from '../components/HeroPremium.jsx'
import FeatureGrid from '../components/FeatureGrid.jsx'
import JourneyTimeline from '../components/JourneyTimeline.jsx'
import PrivacySection from '../components/PrivacySection.jsx'
import EventsShowcase from '../components/EventsShowcase.jsx'
import CampusVerified from '../components/CampusVerified.jsx'
import CTA from '../components/CTA.jsx'
import Footer from '../components/Footer.jsx'
import '../styles/HeroPremium.css'

/**
 * The `chp-landing` wrapper class is what makes the whole page premium,
 * not just the Hero — src/styles/HeroPremium.css scopes a set of CSS
 * overrides under this exact class name that recolor the shared
 * design-system classes already used throughout every section below
 * (text-ink, text-ink-soft, bg-surface, border-line, shadow-card, the
 * `eyebrow` utility, etc.) into the dark/glass palette, WITHOUT editing
 * FeatureGrid/JourneyTimeline/PrivacySection/EventsShowcase/
 * CampusVerified/CTA/Footer individually. This is deliberate: those
 * seven files (and the two sub-components FeatureGrid renders,
 * SectionHeading and FeatureCard) are untouched — same structure, same
 * content, same props — only what their existing classes resolve to
 * visually has changed, and only on this page (the override is scoped
 * to `.chp-landing`, so it can never reach Login/Signup/authenticated
 * pages, which share some of the same class names via AuthLayout).
 *
 * `chp-landing__backdrop` is a single, lightweight, fixed gradient
 * layer behind the entire page — this is what removes the "hard
 * cutoff" after Hero: every section sits on the same continuous dark
 * base color instead of each one supplying its own. It's intentionally
 * simpler than Hero's own AnimatedBackgroundPremium (no duplicated
 * particle/ring animation running underneath the whole page) — running
 * two full copies of that system at once would be wasted GPU work for
 * content the user has already scrolled past.
 */
export default function LandingPage() {
  return (
    <div className="chp-landing min-h-screen">
      <div className="chp-landing__backdrop" aria-hidden="true" />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <FeatureGrid />
        <JourneyTimeline />
        <PrivacySection />
        <EventsShowcase />
        <CampusVerified />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}