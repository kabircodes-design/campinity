import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, MessageCircle, Sparkles } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import VerifiedBadge from '../components/VerifiedBadge.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { auth } from '../firebase/firebase.js'
import { followUser, unfollowUser } from '../firebase/profileService.js'
import { matchTier } from './radarService.js'
import { useStartConversation } from '../hooks/useStartConversation.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

const TIER_COLOR = { high: 'text-emerald-600 bg-emerald-50', medium: 'text-blue-600 bg-blue-50', low: 'text-gray-500 bg-gray-100' }

/**
 * Approximate only — never the raw distanceMeters value or anything
 * derivable back to lat/lng, per the explicit "never expose raw
 * coordinates, use approximate distance" requirement. Rounded to the
 * nearest 10m band; radarLocationService.js's RADAR_RADIUS_METERS
 * (300) already bounds the max value this ever receives.
 */
function formatDistance(meters) {
  if (meters < 15) return 'Right nearby'
  const rounded = Math.round(meters / 10) * 10
  return `~${rounded}m away`
}

/**
 * The discovery card Radar never actually had — previously the only
 * way to see a match was the abstract scatter-plot scanner (still
 * used above this as a hero visualization) plus a tap-to-open detail
 * sheet; there was no persistent, scannable list at all, so this is
 * new, not a redesign of something broken. Reuses the exact
 * follow-button pattern already established in FollowUserCard.jsx
 * (optimistic toggle, same profileService.js functions) and the exact
 * message pattern already established in RadarProfileSheet.jsx
 * (getOrCreateChat + navigate) — no duplicate follow/message system.
 */
export default function RadarUserCard({ match, onOpen }) {
  const currentUid = auth.currentUser?.uid
  const { startConversation, busy: messageBusy, gateOpen, setGateOpen } = useStartConversation()

  const [isFollowing, setIsFollowing] = useState(Boolean(match.isFollowing))
  const [followBusy, setFollowBusy] = useState(false)

  const tier = matchTier(match.score)
  const subtitle = [match.course, match.year].filter(Boolean).join(' · ')

  const handleFollow = async (event) => {
    event.stopPropagation()
    if (!currentUid || followBusy) return
    setFollowBusy(true)
    const next = !isFollowing
    setIsFollowing(next)
    try {
      if (next) await followUser(currentUid, match.uid)
      else await unfollowUser(currentUid, match.uid)
    } catch {
      setIsFollowing(!next)
    } finally {
      setFollowBusy(false)
    }
  }

  const handleMessage = (event) => {
    event.stopPropagation()
    startConversation(currentUid, match.uid)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(match)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(match)
      }}
      className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:border-gray-200 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
    >
      <div className="flex items-center gap-3">
        <Avatar
          initials={getInitials(match.displayName)}
          colorClass={getAvatarColor(match.uid)}
          size="lg"
          src={getProfileIdentityImage(match) || undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{match.displayName || 'Student'}</p>
            <VerifiedBadge verified={match.verifiedCampus} size="sm" />
          </div>
          {match.username && <p className="text-xs text-gray-400 truncate">@{match.username}</p>}
          {subtitle && <p className="text-[11px] text-gray-400 truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {match.distanceMeters != null ? (
        <span className="inline-flex items-center gap-1 self-start rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold px-2.5 py-1">
          <MapPin className="w-3 h-3" /> {formatDistance(match.distanceMeters)}
        </span>
      ) : match.reasons?.length > 0 ? (
        <span className={`inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold ${TIER_COLOR[tier]}`}>
          <Sparkles className="w-3 h-3" /> {match.reasons[0]}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold text-gray-500 bg-gray-100">
          On your campus
        </span>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <button
          type="button"
          onClick={handleFollow}
          disabled={followBusy}
          aria-pressed={isFollowing}
          className={`flex-1 rounded-full text-xs font-semibold py-2 transition-all duration-300 disabled:opacity-60 ${
            isFollowing
              ? 'border border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {followBusy ? '...' : isFollowing ? 'Following' : 'Follow'}
        </button>
        <button
          type="button"
          onClick={handleMessage}
          disabled={messageBusy}
          aria-label={`Message ${match.displayName || 'this student'}`}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-700 text-xs font-semibold py-2 hover:border-gray-300 transition-all duration-300 disabled:opacity-60"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Message
        </button>
      </div>
      {/* stopPropagation wrapper: React portals still bubble synthetic events through the JSX tree, not the DOM tree — without this, a click inside the gate (which the card's own onOpen onClick sits above) would also fire onOpen(match). */}
      <div onClick={(event) => event.stopPropagation()}>
        <VerificationGate open={gateOpen} onClose={() => setGateOpen(false)} feature={FEATURES.SEND_MESSAGE} />
      </div>
    </motion.div>
  )
}
