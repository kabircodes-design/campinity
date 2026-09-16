import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Calendar, Camera, Link as LinkIcon, MessageCircle, MoreVertical, Pencil, Share2 } from 'lucide-react'
import ProfilePhotoEditor from '../avatar/ProfilePhotoEditor.jsx'
import Avatar from './Avatar.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import ReportModal from './ReportModal.jsx'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { auth } from '../firebase/firebase.js'
import { blockUser, isBlocking, unblockUser } from '../firebase/blockService.js'

/**
 * Complete redesign — built fresh since this is an explicit redesign
 * task, not a preservation-of-unknown-behavior task. Uses ONLY fields
 * confirmed to exist in profileService.js's real getUserProfile shape
 * (displayName, username, bio, course, year, verifiedCampus, avatar,
 * followersCount, followingCount, createdAt) plus college (resolved
 * separately, same as the old ProfilePage.jsx already did via
 * getCollegeById) and website (new field — added via
 * updateUserProfile's existing generic merge write, no schema
 * migration needed, Firestore documents don't require every field to
 * pre-exist).
 *
 * "Verification badge" and "Campus badge" from the brief collapse
 * into ONE badge here (verifiedCampus) — the real schema only has one
 * verification concept, not two. Showing two separate badges for one
 * underlying flag would be decorative duplication, not two real
 * signals.
 */
export default function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  onEdit,
  onFollow,
  onUnfollow,
  onMessage,
  onOpenMessageRequest,
  messageState = 'none', // 'none' | 'pending_outgoing' | 'pending_incoming' | 'accepted' — see item 10, resolved from real chat data by the caller (StudentProfilePlaceholder.jsx), never guessed here
  messageBusy = false, // true while getOrCreateChat() is in flight — disables the button so a double-click can't race two chat-creation attempts
  onShare,
  onOpenFollowers,
  onOpenFollowing,
  mutualFollowers = []
}) {
  const [followBusy, setFollowBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  useEffect(() => {
    if (isOwnProfile || !profile?.uid) return
    const uid = auth.currentUser?.uid
    if (!uid) return
    isBlocking(uid, profile.uid).then(setBlocked).catch(() => {})
  }, [isOwnProfile, profile?.uid])

  const handleToggleBlock = async () => {
    const uid = auth.currentUser?.uid
    if (!uid || !profile?.uid || blockBusy) return
    setBlockBusy(true)
    try {
      if (blocked) {
        await unblockUser(uid, profile.uid)
        setBlocked(false)
      } else {
        await blockUser(uid, profile.uid)
        setBlocked(true)
      }
    } catch {
      // best-effort — menu stays open, state simply doesn't flip
    } finally {
      setBlockBusy(false)
      setMenuOpen(false)
    }
  }

  const joinedLabel = profile.createdAt?.toDate
    ? profile.createdAt.toDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null

  const courseYearLabel = [profile.course, profile.year].filter(Boolean).join(' · ')

  const handleFollowClick = async () => {
    setFollowBusy(true)
    try {
      if (isFollowing) {
        await onUnfollow?.()
      } else {
        await onFollow?.()
      }
    } finally {
      setFollowBusy(false)
    }
  }

  return (
    <div className="pb-4">
      <div className="relative h-40 lg:h-48 bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 overflow-hidden">
        {profile.coverPhoto ? (
          <img src={profile.coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 left-1/4 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          </>
        )}
      </div>
      <div className="px-4 -mt-12">
      <div className="flex items-end justify-between gap-3">
        <div
          className={`flex-shrink-0 rounded-full ring-4 ring-white dark:ring-[#11131a] relative group ${isOwnProfile ? 'cursor-pointer' : ''}`}
          onClick={() => isOwnProfile && setPhotoEditorOpen(true)}
        >
          <Avatar
            initials={profile.initials}
            colorClass={profile.colorClass}
            size="xl"
            src={getProfileIdentityImage(profile) || undefined}
          />
          {isOwnProfile && (
            <>
              <div className="hidden lg:flex absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div className="lg:hidden absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-600 border-2 border-white dark:border-[#11131a] flex items-center justify-center">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 truncate">{profile.displayName}</h1>
          <VerifiedBadge verified={profile.verifiedCampus} size="lg" />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">@{profile.username}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {courseYearLabel && <p className="text-[13px] text-gray-500 dark:text-gray-400">{courseYearLabel}</p>}
          {profile.verifiedCampus && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 text-[11px] font-semibold px-2.5 py-1">
              <BadgeCheck className="w-3 h-3" />
              Verified Campus Member
            </span>
          )}
        </div>
      </div>

      {profile.bio && <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>}

      {Array.isArray(profile.interests) && profile.interests.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {profile.interests.slice(0, 6).map((interest) => (
            <span key={interest} className="rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 text-[11px] font-semibold px-2.5 py-1">
              #{interest.replace(/\s+/g, '')}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 space-y-1">
        {profile.college && <p className="text-[13px] text-gray-500 dark:text-gray-400">{profile.college}</p>}
        {joinedLabel && (
          <p className="flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            Joined {joinedLabel}
          </p>
        )}
        {profile.website && (
          <a
            href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-blue-600 hover:underline w-fit"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            {profile.website.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-50">{profile.postsCount}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Posts</p>
        </div>
        <button type="button" onClick={onOpenFollowers} className="hover:opacity-70 transition-opacity duration-200">
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-50">{profile.followers}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Followers</p>
        </button>
        <button type="button" onClick={onOpenFollowing} className="hover:opacity-70 transition-opacity duration-200">
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-50">{profile.following}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Following</p>
        </button>
        <div>
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-50">{profile.communitiesCount ?? '—'}</p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">Communities</p>
        </div>
      </div>

      {!isOwnProfile && mutualFollowers.length > 0 && (
        <p className="mt-3 text-[12.5px] text-gray-500 dark:text-gray-400">
          Followed by{' '}
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {mutualFollowers
              .slice(0, 2)
              .map((u) => u.displayName)
              .join(', ')}
          </span>
          {mutualFollowers.length > 2 && (
            <span className="font-semibold text-gray-700 dark:text-gray-300"> and {mutualFollowers.length - 2} others</span>
          )}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {isOwnProfile ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:border-white/20 dark:hover:bg-white/5 transition-all duration-300"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleFollowClick}
              disabled={followBusy}
              className={`flex-1 rounded-full text-sm font-semibold py-2.5 transition-all duration-300 disabled:opacity-50 ${
                isFollowing
                  ? 'border border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-500 dark:border-white/10 dark:text-gray-300 dark:hover:border-red-500/30 dark:hover:text-red-400'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {followBusy ? '...' : isFollowing ? 'Following' : 'Follow'}
            </button>
            <button
              type="button"
              onClick={blocked || messageBusy ? undefined : messageState === 'pending_incoming' ? onOpenMessageRequest : onMessage}
              disabled={blocked || messageBusy}
              aria-label={
                blocked
                  ? 'Blocked'
                  : messageState === 'pending_outgoing'
                    ? 'Request sent'
                    : messageState === 'pending_incoming'
                      ? 'View message request'
                      : 'Message'
              }
              title={
                blocked
                  ? "You've blocked this person"
                  : messageState === 'pending_outgoing'
                    ? 'Request sent — waiting for them to accept'
                    : messageState === 'pending_incoming'
                      ? 'They sent you a message request'
                      : 'Message'
              }
              className={`flex-shrink-0 rounded-full border flex items-center justify-center transition-all duration-300 ${
                messageState === 'pending_outgoing' || messageState === 'pending_incoming'
                  ? 'h-11 px-3.5 gap-1.5 border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400'
                  : 'w-11 h-11 border-gray-200 text-gray-600 hover:border-gray-300 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/20'
              } ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              {messageState === 'pending_outgoing' && <span className="text-xs font-semibold whitespace-nowrap">Request Sent</span>}
              {messageState === 'pending_incoming' && <span className="text-xs font-semibold whitespace-nowrap">Message Request</span>}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onShare}
          aria-label="Share profile"
          className="w-11 h-11 flex-shrink-0 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/20 transition-all duration-300"
        >
          <Share2 className="w-4 h-4" />
        </button>
        {!isOwnProfile && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/20 transition-all duration-300"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              // z-40, not z-30: the profile page's tabs nav below this
              // header is `sticky` at the SAME z-30 — at equal z-index,
              // the later element in the DOM (the tabs) paints on top,
              // so this menu (opened, positioned top-12 below the "..."
              // button) could render partially BEHIND the sticky tabs
              // row on a compact header, with just the last item (Block,
              // in red) visible poking out underneath — exactly the
              // "stray red BLOCK leaking into the tabs" bug. A real
              // dropdown menu must always paint above page content, so
              // this raises it clearly above that collision instead of
              // relying on DOM order to accidentally not collide.
              <div className="absolute right-0 top-12 w-40 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-40 dark:border-white/10 dark:bg-[#181b24]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setReportOpen(true)
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5 transition-all duration-150"
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  disabled={blockBusy}
                  className="w-full text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-all duration-150 disabled:opacity-50"
                >
                  {blocked ? 'Unblock' : 'Block'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      </div>

      {isOwnProfile && (
        <ProfilePhotoEditor
          open={photoEditorOpen}
          onClose={() => setPhotoEditorOpen(false)}
          currentPhotoUrl={getProfileIdentityImage(profile)}
        />
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId={profile?.uid}
        targetOwnerUid={profile?.uid}
      />
    </div>
  )
}
