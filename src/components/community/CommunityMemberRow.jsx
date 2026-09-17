import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, MoreHorizontal, ShieldCheck } from 'lucide-react'
import Avatar from '../Avatar.jsx'
import VerifiedBadge from '../VerifiedBadge.jsx'
import ReportModal from '../ReportModal.jsx'
import { auth } from '../../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../../firebase/postService.js'
import { getProfileIdentityImage } from '../../avatar/profileIdentity.js'
import { followUser, unfollowUser } from '../../firebase/profileService.js'
import { blockUser } from '../../firebase/blockService.js'
import { getOrCreateChat } from '../../firebase/chatService.js'
import { isUserMuted, muteUser, unmuteUser } from '../../firebase/muteService.js'

const roleLabels = { owner: 'Owner', admin: 'Admin', moderator: 'Moderator' }
const roleColors = {
  owner: 'text-amber-600 bg-amber-50',
  admin: 'text-blue-600 bg-blue-50',
  moderator: 'text-violet-600 bg-violet-50'
}

/**
 * The real member-directory row — replaces CommunityDetailPage's old
 * `{member.uid}` text render. `profile` is the enriched getUserProfile()
 * result (null while still loading/missing); everything here degrades to
 * "Student" + no avatar rather than ever falling back to printing the
 * raw uid again.
 */
export default function CommunityMemberRow({
  member,
  profile,
  isOwner,
  canManage,
  canManageAdmins,
  busy,
  onPromoteModerator,
  onDemoteModerator,
  onPromoteAdmin,
  onRemoveAdmin,
  onTransferOwnership,
  onRemove,
  onBan,
  onMuteChanged = () => {}
}) {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid
  const isSelf = member.uid === currentUid

  const [isFollowing, setIsFollowing] = useState(Boolean(profile?.viewerIsFollowing))
  const [followBusy, setFollowBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [messageBusy, setMessageBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'remove' | 'ban' | null
  const [isMuted, setIsMuted] = useState(false)
  const [muteBusy, setMuteBusy] = useState(false)

  // Per-member mute — personal, one-directional, invisible to the
  // muted person (users/{uid}/mutedUsers/{targetUid}, owner-only read —
  // see muteService.js/firestore.rules). Distinct from "Mute Community"
  // (a community-wide notification preference the viewer sets on their
  // OWN membership doc) — this instead hides/collapses one specific
  // member's posts from the viewer's own feed, nothing else changes.
  useEffect(() => {
    if (isSelf || !currentUid) return
    let cancelled = false
    isUserMuted(currentUid, member.uid).then((muted) => {
      if (!cancelled) setIsMuted(muted)
    })
    return () => {
      cancelled = true
    }
  }, [currentUid, member.uid, isSelf])

  const handleToggleMute = async () => {
    if (!currentUid || muteBusy) return
    setMuteBusy(true)
    const next = !isMuted
    try {
      if (next) await muteUser(currentUid, member.uid)
      else await unmuteUser(currentUid, member.uid)
      setIsMuted(next)
      onMuteChanged(member.uid, next)
    } catch {
      // best-effort — stays on its current state on failure
    } finally {
      setMuteBusy(false)
    }
  }

  const displayName = profile?.displayName || 'Student'
  const meta = [profile?.year, profile?.course].filter(Boolean).join(' • ')
  const joinedLabel = member.joinedAt?.toDate
    ? member.joinedAt.toDate().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  const goToProfile = () => {
    if (profile?.username) navigate(`/student/${profile.username}`)
  }

  const handleFollow = async (event) => {
    event.stopPropagation()
    if (!currentUid || followBusy) return
    setFollowBusy(true)
    const next = !isFollowing
    setIsFollowing(next)
    try {
      if (next) await followUser(currentUid, member.uid)
      else await unfollowUser(currentUid, member.uid)
    } catch {
      setIsFollowing(!next)
    } finally {
      setFollowBusy(false)
    }
  }

  const handleMessage = async (event) => {
    event.stopPropagation()
    if (!currentUid || messageBusy) return
    setMessageBusy(true)
    try {
      const { chatId } = await getOrCreateChat(currentUid, member.uid)
      navigate(`/messages/${chatId}`)
    } catch {
      // best-effort — stays put on failure, no broken navigation
    } finally {
      setMessageBusy(false)
    }
  }

  const handleBlock = async () => {
    if (!currentUid) return
    setMenuOpen(false)
    try {
      await blockUser(currentUid, member.uid)
      setBlocked(true)
    } catch {
      // best-effort
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-gray-50 transition-colors duration-200">
      <button type="button" onClick={goToProfile} className="flex-shrink-0" aria-label={`Open ${displayName}'s profile`}>
        <Avatar
          initials={getInitials(displayName)}
          colorClass={getAvatarColor(member.uid)}
          size="md"
          src={profile ? getProfileIdentityImage(profile) || undefined : undefined}
        />
      </button>

      <button type="button" onClick={goToProfile} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          <VerifiedBadge verified={profile?.verifiedCampus} size="sm" />
        </div>
        <p className="text-xs text-gray-400 truncate">
          {profile?.username ? `@${profile.username}` : 'Profile unavailable'}
          {meta && ` · ${meta}`}
        </p>
        {!meta && joinedLabel && <p className="text-[11px] text-gray-300 truncate">Joined {joinedLabel}</p>}
      </button>

      {member.role !== 'member' && (
        <span className={`hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-1 ${roleColors[member.role] || 'text-gray-500 bg-gray-100'}`}>
          {member.role === 'owner' && <ShieldCheck className="w-3 h-3" />}
          {roleLabels[member.role] || member.role}
        </span>
      )}

      {!isSelf && !blocked && (
        <button
          type="button"
          onClick={handleMessage}
          disabled={messageBusy}
          aria-label={`Message ${displayName}`}
          className="hidden sm:flex flex-shrink-0 w-8 h-8 rounded-full items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all duration-200"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      )}

      {!isSelf && (
        <button
          type="button"
          onClick={handleFollow}
          disabled={followBusy}
          className={`hidden sm:inline-flex flex-shrink-0 rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 disabled:opacity-60 ${
            isFollowing ? 'border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-500' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {followBusy ? '···' : isFollowing ? 'Following' : 'Follow'}
        </button>
      )}

      {!isSelf && (
        <div className="relative flex-shrink-0">
          <button
            type="button"
            aria-label="More options"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-gray-100 bg-white shadow-lg py-1">
                {canManage && member.role === 'member' && (
                  <MenuItem onClick={() => { setMenuOpen(false); onPromoteModerator(member.uid) }} disabled={busy}>
                    Promote to Moderator
                  </MenuItem>
                )}
                {canManage && member.role === 'moderator' && (
                  <MenuItem onClick={() => { setMenuOpen(false); onDemoteModerator(member.uid) }} disabled={busy}>
                    Demote to Member
                  </MenuItem>
                )}
                {canManageAdmins && (member.role === 'member' || member.role === 'moderator') && (
                  <MenuItem onClick={() => { setMenuOpen(false); onPromoteAdmin(member.uid) }} disabled={busy}>
                    Promote to Admin
                  </MenuItem>
                )}
                {isOwner && member.role === 'admin' && (
                  <MenuItem onClick={() => { setMenuOpen(false); onRemoveAdmin(member.uid) }} disabled={busy}>
                    Remove Admin
                  </MenuItem>
                )}
                {isOwner && member.role !== 'owner' && (
                  <MenuItem onClick={() => { setMenuOpen(false); onTransferOwnership(member.uid) }} disabled={busy}>
                    Make Owner
                  </MenuItem>
                )}
                {canManage && member.role !== 'owner' && (
                  <MenuItem danger onClick={() => { setMenuOpen(false); setConfirmAction('remove') }} disabled={busy}>
                    Remove from community
                  </MenuItem>
                )}
                {canManage && member.role !== 'owner' && onBan && (
                  <MenuItem danger onClick={() => { setMenuOpen(false); setConfirmAction('ban') }} disabled={busy}>
                    Ban from community
                  </MenuItem>
                )}
                <MenuItem onClick={() => { setMenuOpen(false); handleToggleMute() }} disabled={muteBusy}>
                  {isMuted ? 'Unmute member' : 'Mute member'}
                </MenuItem>
                <MenuItem onClick={() => { setMenuOpen(false); setReportOpen(true) }}>Report member</MenuItem>
                <MenuItem danger onClick={handleBlock}>Block</MenuItem>
              </div>
            </>
          )}
        </div>
      )}

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={member.uid} targetOwnerUid={member.uid} />

      {confirmAction && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setConfirmAction(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900">
              {confirmAction === 'ban' ? `Ban ${displayName}?` : `Remove ${displayName}?`}
            </p>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
              {confirmAction === 'ban'
                ? "They won't be able to join this community again unless the ban is removed."
                : 'They will be removed from this community.'}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={busy}
                className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'ban') onBan(member.uid)
                  else onRemove(member.uid)
                  setConfirmAction(null)
                }}
                disabled={busy}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50 transition-all duration-200"
              >
                {confirmAction === 'ban' ? 'Ban' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3.5 py-2 text-sm disabled:opacity-50 transition-colors duration-150 ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
