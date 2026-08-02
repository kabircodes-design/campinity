import { useNavigate } from 'react-router-dom'
import { Lock, Users } from 'lucide-react'

const typeLabels = {
  official_club: 'Official Club',
  study_group: 'Study Group',
  hostel: 'Hostel',
  branch: 'Branch',
  batch: 'Batch',
  society: 'Society',
  event: 'Event',
  custom: 'Community'
}

/**
 * Reusable community card. Structure per the exact spec: cover ->
 * avatar -> name -> @handle -> description -> category badge / member
 * count -> Join button.
 *
 * Defensive hardening applied even though the existing code already
 * had the standard-correct pattern (relative parent, fixed height,
 * absolute+object-cover image, overflow-hidden on the outer element):
 * added `overflow-hidden` directly on the cover div too (not just the
 * outer container), and made the outer element explicitly `flex
 * flex-col`. Neither of these can make anything worse; if a subtler
 * cause was producing the reported overflow, this closes off the most
 * likely candidates without touching anything visual.
 *
 * Outer element is a `div` with `role="button"`/keyboard handling, not
 * a real `<button>` — this card now contains a real nested Join
 * `<button>`, and HTML doesn't allow interactive elements nested
 * inside a `<button>`. This was actually wrong in an earlier version
 * of this file (a real `<button>` wrapping everything) before the
 * Join button existed; fixed as part of adding it.
 *
 * Join button deliberately does NOT perform a live per-card membership
 * check or join/leave action itself — doing that here would mean one
 * extra Firestore read PER CARD rendered in a grid (N+1 reads just to
 * decide whether a button says "Join" or "Joined"), which conflicts
 * with this project's own "avoid unnecessary reads" standard elsewhere.
 * It navigates to the community page instead, where real membership
 * state and the actual join/leave/request flow already exist
 * (CommunityDetailPage.jsx) — same destination as tapping the card,
 * just with an explicit, stopPropagation'd action for users who expect
 * a dedicated button.
 */
export default function CommunityCard({ community }) {
  const navigate = useNavigate()

  const goToCommunity = () => navigate(`/community/${community.id}`)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToCommunity}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          goToCommunity()
        }
      }}
      className="w-full flex flex-col text-left rounded-2xl border border-gray-100 bg-white overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all duration-300 cursor-pointer"
    >
      <div className="relative h-20 flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700">
        {community.coverImage && (
          <img src={community.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="px-3.5 pb-3.5">
        <div className="-mt-6 flex items-end justify-between">
          <div className="w-12 h-12 rounded-xl bg-white border-4 border-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
            {community.icon ? (
              <img src={community.icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5 text-blue-600" strokeWidth={1.7} />
            )}
          </div>
          <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5">
            {community.privacy === 'private' && <Lock className="w-2.5 h-2.5" />}
            {community.privacy === 'private' ? 'Private' : 'Public'}
          </span>
        </div>

        <p className="mt-2 text-sm font-bold text-gray-900 truncate">{community.name}</p>
        <p className="text-xs text-gray-400 truncate">@{community.handle}</p>

        {community.description && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed line-clamp-2">{community.description}</p>
        )}

        <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 font-semibold px-2 py-0.5">
            {typeLabels[community.type] || 'Community'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {community.membersCount}
          </span>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            goToCommunity()
          }}
          className="mt-3 w-full text-center rounded-full bg-blue-600 text-white text-xs font-semibold py-2 hover:bg-blue-700 transition-all duration-300"
        >
          Join
        </button>
      </div>
    </div>
  )
}
