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
import '../theme/theme-tokens-landing.css'

/**
 * The `chp-landing` wrapper class scopes CSS overrides that recolor
 * the shared design-system classes used throughout every section below
 * (text-ink, text-ink-soft, bg-surface, border-line, shadow-card, the
 * `eyebrow` utility, etc.) WITHOUT editing FeatureGrid/JourneyTimeline/
 * PrivacySection/EventsShowcase/CampusVerified/CTA/Footer individually.
 *
 * Two layers of override are active here, loaded in this order on
 * purpose:
 *   1. HeroPremium.css — the original scoped recolor (fixed dark/glass
 *      values, predates the light/dark theme system).
 *   2. theme-tokens-landing.css — shadows every one of those same
 *      rules with theme-reactive versions sourced from --theme-*
 *      tokens, `!important` to guarantee it wins regardless of load
 *      order. This is what makes the landing page sections actually
 *      respond to the theme toggle instead of sitting permanently dark.
 *      See that file's own header comment for the full explanation.
 *
 * `chp-landing__backdrop` is a single, lightweight, fixed gradient
 * layer behind the entire page, also now theme-reactive via the same
 * override file rather than hardcoded dark.
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
