import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Clock, Crown, Lock, Plus, Sparkles, Users } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { joinCommunity, requestToJoin } from '../firebase/communityService.js'
import { getInitials } from '../firebase/postService.js'
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

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function formatMembers(count) {
  const n = Number(count) || 0
  const value = n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n)
  return `${value} ${n === 1 ? 'member' : 'members'}`
}

/**
 * Community / club card. Business logic is unchanged: the
 * membershipState machine (owner / member / pending / none), the real
 * joinCommunity() / requestToJoin() calls, the verification gate and
 * the onStateChange callback.
 *
 * The "New" badge is real — derived from the community's own createdAt
 * (created in the last 7 days). No activity/growth metrics are invented.
 */
export default function CommunityCard({ community, membershipState = null, onStateChange }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [localState, setLocalState] = useState(null)
  const [hasOverride, setHasOverride] = useState(false)
  const verified = useMyVerification()
  const [gateOpen, setGateOpen] = useState(false)
  const [actionError, setActionError] = useState('')

  const state = hasOverride ? localState : membershipState
  // Clubs (type 'official_club') open their own page (/club/:id).
  const goToCommunity = () => navigate(community.type === 'official_club' ? `/club/${community.id}` : `/community/${community.id}`)
  const isNew = community.createdAt?.toMillis && Date.now() - community.createdAt.toMillis() < NEW_WINDOW_MS
  const isPrivate = community.privacy === 'private'

  const handleAction = async (event) => {
    event.stopPropagation()
    const uid = auth.currentUser?.uid
    if (!uid || busy || state) return
    if (verified === false) {
      setGateOpen(true)
      return
    }
    setBusy(true)
    setActionError('')
    try {
      if (isPrivate) {
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
      // The button stays in its real (unchanged) state; say why.
      setActionError(isPrivate ? "Couldn't send request. Try again." : "Couldn't join. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const buttonConfig = {
    owner: { label: 'Manage', aria: `Manage ${community.name}`, className: 'bg-gray-100 text-gray-700 hover:bg-gray-200', icon: <Crown className="w-3.5 h-3.5" />, action: goToCommunity },
    member: { label: 'Joined', aria: `Joined ${community.name} — open`, className: 'bg-emerald-50 text-emerald-600', icon: <Check className="w-3.5 h-3.5" strokeWidth={2.6} />, action: goToCommunity },
    pending: { label: 'Requested', aria: `Request to join ${community.name} sent`, className: 'bg-gray-100 text-gray-400', icon: <Clock className="w-3.5 h-3.5" />, action: null }
  }[state] || {
    label: isPrivate ? 'Request' : 'Join',
    aria: isPrivate ? `Request to join ${community.name}` : `Join ${community.name}`,
    className: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/25',
    icon: isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" strokeWidth={2.6} />,
    action: handleAction
  }

  const image = community.icon || community.coverImage

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={goToCommunity}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          goToCommunity()
        }
      }}
      aria-label={community.name}
      className="w-full min-w-0 flex flex-col text-left rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] active:scale-[0.99] transition-all duration-200 cursor-pointer p-3.5"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden bg-blue-600 flex items-center justify-center ring-1 ring-black/5">
          {image ? (
            <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white text-base font-bold">{getInitials(community.name) || <Users className="w-5 h-5" />}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-[15px] font-bold text-gray-900 truncate leading-tight">{community.name}</p>
            {isPrivate && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" aria-label="Private" />}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 leading-snug break-words">
            {typeLabels[community.type] || 'Community'} · {formatMembers(community.membersCount)}
          </p>
          {isNew && !state && (
            <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5">
              <Sparkles className="w-2.5 h-2.5" /> New
            </span>
          )}
        </div>

        <button
          type="button"
          aria-label={buttonConfig.aria}
          onClick={(event) => {
            event.stopPropagation()
            if (buttonConfig.action === goToCommunity) goToCommunity()
            else if (buttonConfig.action) buttonConfig.action(event)
          }}
          disabled={busy || !buttonConfig.action}
          className={`flex-shrink-0 min-w-[84px] h-9 inline-flex items-center justify-center gap-1 rounded-full text-[13px] font-semibold px-3.5 transition-all duration-200 active:scale-95 disabled:active:scale-100 ${busy ? 'opacity-60' : ''} ${buttonConfig.className}`}
        >
          {busy ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
          ) : (
            buttonConfig.icon
          )}
          {buttonConfig.label}
        </button>
      </div>

      {actionError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {actionError}
        </p>
      )}

      {community.description && (
        <p className="mt-2.5 text-[13px] text-gray-500 leading-relaxed line-clamp-2">{community.description}</p>
      )}

      {community.tags?.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          {community.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium px-2 py-0.5 max-w-[140px] truncate">
              #{String(tag).replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
      <VerificationGate open={gateOpen} onClose={() => setGateOpen(false)} feature={FEATURES.JOIN_PRIVATE_COMMUNITY} />
    </div>
  )
}
