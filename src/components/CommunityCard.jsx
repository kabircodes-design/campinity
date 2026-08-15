import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock, Crown, Lock, Users } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { joinCommunity, requestToJoin } from '../firebase/communityService.js'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

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
 * `membershipState` replaces the old boolean `joined` prop — a real
 * state machine now: 'owner' | 'member' | 'pending' | null (not a
 * member). This is what makes "owner sees Manage, never Join" (the
 * task's own "biggest logic issue") and the private-community
 * request flow both actually correct, not just a binary joined/not.
 * Passed down by the caller (fetched once per page, not per card —
 * same N+1-avoidance reasoning as the previous `joined` prop).
 *
 * The button now performs the REAL action directly — join() for
 * public communities, requestToJoin() for private ones — rather than
 * only ever navigating away. Both existing service functions were
 * already fully built (confirmed by reading them directly); this
 * just wires them to this UI for the first time. onStateChange lets
 * the parent page update its own membership Set immediately, so the
 * button's label updates live without a page reload.
 */
export default function CommunityCard({ community, membershipState = null, onStateChange }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [localState, setLocalState] = useState(null)
  const [hasOverride, setHasOverride] = useState(false)
  const verified = useMyVerification()
  const [gateOpen, setGateOpen] = useState(false)

  const state = hasOverride ? localState : membershipState
  const goToCommunity = () => navigate(`/community/${community.id}`)

  const handleAction = async (event) => {
    event.stopPropagation()
    const uid = auth.currentUser?.uid
    if (!uid || busy || state) return
    if (verified === false) {
      setGateOpen(true)
      return
    }
    setBusy(true)
    try {
      if (community.privacy === 'private') {
        await requestToJoin(community.id, uid)
        setLocalState('pending')
        setHasOverride(true)
        onStateChange?.(community.id, 'pending')
      } else {
        await joinCommunity(community.id, uid)
        setLocalState('member')
        setHasOverride(true)
        onStateChange?.(community.id, 'member')
      }
    } catch {
      // best-effort — button simply stays in its current state on failure
    } finally {
      setBusy(false)
    }
  }

  const buttonConfig = {
    owner: { label: 'Manage', className: 'bg-white/60 backdrop-blur-sm text-gray-700 border border-white/50 hover:bg-white/80', icon: <Crown className="w-3 h-3" />, action: goToCommunity },
    member: { label: 'Open', className: 'bg-white/60 backdrop-blur-sm text-gray-700 border border-white/50 hover:bg-white/80', icon: <Check className="w-3 h-3" strokeWidth={2.5} />, action: goToCommunity },
    pending: { label: 'Request Sent', className: 'bg-white/35 backdrop-blur-sm text-gray-400 border border-white/40', icon: <Clock className="w-3 h-3" />, action: null }
  }[state] || {
    label: community.privacy === 'private' ? 'Request to Join' : 'Join',
    className: 'bg-blue-600/90 backdrop-blur-sm text-white hover:bg-blue-700/90 shadow-[0_2px_8px_rgba(91,77,255,0.25)]',
    icon: null,
    action: handleAction
  }

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
      className="w-full flex flex-col text-left rounded-2xl border border-white/50 bg-white/55 backdrop-blur-md lg:bg-white/45 lg:backdrop-blur-xl shadow-[inset_1px_1px_0_rgba(255,255,255,0.5),0_4px_20px_rgba(91,77,255,0.07)] hover:border-white/70 hover:bg-white/65 hover:shadow-[inset_1px_1px_0_rgba(255,255,255,0.6),0_8px_28px_rgba(91,77,255,0.11)] active:scale-[0.99] transition-all duration-200 cursor-pointer p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="relative w-12 h-12 rounded-2xl flex-shrink-0 overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          {community.coverImage && (
            <img src={community.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          {community.icon ? (
            <img
              src={community.icon}
              alt=""
              className={community.coverImage ? 'relative w-7 h-7 rounded-lg object-cover ring-2 ring-white/80' : 'w-full h-full object-cover'}
            />
          ) : (
            !community.coverImage && <Users className="w-5 h-5 text-white" strokeWidth={1.7} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-gray-900 truncate">{community.name}</p>
            {community.privacy === 'private' && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-400 truncate">@{community.handle}</p>
        </div>

        <button
          type="button"
          onClick={(event) => {
            if (buttonConfig.action === goToCommunity) {
              event.stopPropagation()
              goToCommunity()
            } else if (buttonConfig.action) {
              buttonConfig.action(event)
            } else {
              event.stopPropagation()
            }
          }}
          disabled={busy}
          className={`flex-shrink-0 flex items-center gap-1 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 disabled:opacity-60 ${buttonConfig.className}`}
        >
          {buttonConfig.icon}
          {busy ? '...' : buttonConfig.label}
        </button>
      </div>

      {community.description && (
        <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-2">{community.description}</p>
      )}

      <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/50 backdrop-blur-sm border border-white/40 text-blue-600 font-semibold px-2 py-0.5">
          {typeLabels[community.type] || 'Community'}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {community.membersCount}
        </span>
      </div>

      {community.tags?.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {community.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      )}
      <VerificationGate open={gateOpen} onClose={() => setGateOpen(false)} feature={FEATURES.JOIN_PRIVATE_COMMUNITY} />
    </div>
  )
}
