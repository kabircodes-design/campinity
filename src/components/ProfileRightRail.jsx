import CampusImpactCard from '../gamification/CampusImpactCard.jsx'
import CampusJourneyCard from '../gamification/CampusJourneyCard.jsx'

/**
 * Desktop-only right column for ProfilePage.jsx. Previously duplicated
 * content already shown elsewhere on the same page — an "About" card
 * (now redundant: the About tab was removed), "Quick Stats" (already
 * shown in ProfileHeader's own Posts/Followers/Following/Communities
 * row), and preview cards for My Communities/Photos (already full tabs
 * one click away) — which is exactly what made the page feel like
 * "a dashboard dumped into a profile." Now holds Campus Impact/Next
 * Unlock/Campus Journey instead: real, once-per-page content, not
 * shown anywhere else. On mobile (no right column), ProfilePage.jsx
 * renders the same two components inline instead — never both at
 * once, so there's no duplicate mount or double Firestore read.
 */
export default function ProfileRightRail({ uid }) {
  return (
    <aside className="hidden lg:flex lg:flex-col w-[300px] flex-shrink-0 gap-4 py-4">
      <CampusImpactCard uid={uid} />
      <CampusJourneyCard uid={uid} />
    </aside>
  )
}
