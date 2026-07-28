import Nav from '../components/Nav.jsx'
import Hero from '../components/HeroPremium.jsx'
import FeatureGrid from '../components/FeatureGrid.jsx'
import JourneyTimeline from '../components/JourneyTimeline.jsx'
import PrivacySection from '../components/PrivacySection.jsx'
import EventsShowcase from '../components/EventsShowcase.jsx'
import CampusVerified from '../components/CampusVerified.jsx'
import CTA from '../components/CTA.jsx'
import Footer from '../components/Footer.jsx'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main>
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
