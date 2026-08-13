import { useEffect, useState } from 'react'
import { BadgeCheck, Calendar, Camera, Link as LinkIcon, MessageCircle, MoreVertical, Share2 } from 'lucide-react'
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
      <div className="relative h-24 lg:h-28 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 left-1/3 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>
      <div className="px-4 -mt-8">
      <div className="flex items-start gap-4">
        <div
          className={`flex-shrink-0 rounded-full ring-4 ring-white relative group ${isOwnProfile ? 'cursor-pointer' : ''}`}
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
              <div className="lg:hidden absolute bottom-0 right-0 w-6 h-6 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                <Camera className="w-3 h-3 text-white" />
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold text-gray-900 truncate">{profile.displayName}</h1>
            <VerifiedBadge verified={profile.verifiedCampus} size="lg" />
          </div>
          <p className="text-sm text-gray-400">@{profile.username}</p>
          {profile.verifiedCampus && (
            <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold px-2.5 py-1">
              <BadgeCheck className="w-3 h-3" />
              Verified Campus Member
            </span>
          )}
        </div>
      </div>

      {profile.bio && <p className="mt-3 text-sm text-gray-700 leading-relaxed">{profile.bio}</p>}

      <div className="mt-2.5 space-y-1">
        {profile.college && <p className="text-[13px] text-gray-500">{profile.college}</p>}
        {courseYearLabel && <p className="text-[13px] text-gray-500">{courseYearLabel}</p>}
        {joinedLabel && (
          <p className="flex items-center gap-1.5 text-[13px] text-gray-400">
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
          <p className="text-[15px] font-bold text-gray-900">{profile.postsCount}</p>
          <p className="text-[11px] text-gray-400">Posts</p>
        </div>
        <button type="button" onClick={onOpenFollowers} className="hover:opacity-70 transition-opacity duration-200">
          <p className="text-[15px] font-bold text-gray-900">{profile.followers}</p>
          <p className="text-[11px] text-gray-400">Followers</p>
        </button>
        <button type="button" onClick={onOpenFollowing} className="hover:opacity-70 transition-opacity duration-200">
          <p className="text-[15px] font-bold text-gray-900">{profile.following}</p>
          <p className="text-[11px] text-gray-400">Following</p>
        </button>
        <div>
          <p className="text-[15px] font-bold text-gray-900">{profile.communitiesCount ?? '—'}</p>
          <p className="text-[11px] text-gray-400">Communities</p>
        </div>
      </div>

      {!isOwnProfile && mutualFollowers.length > 0 && (
        <p className="mt-3 text-[12.5px] text-gray-500">
          Followed by{' '}
          <span className="font-semibold text-gray-700">
            {mutualFollowers
              .slice(0, 2)
              .map((u) => u.displayName)
              .join(', ')}
          </span>
          {mutualFollowers.length > 2 && (
            <span className="font-semibold text-gray-700"> and {mutualFollowers.length - 2} others</span>
          )}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {isOwnProfile ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 transition-all duration-300"
          >
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
                  ? 'border border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {followBusy ? '...' : isFollowing ? 'Following' : 'Follow'}
            </button>
            <button
              type="button"
              onClick={onMessage}
              aria-label="Message"
              className="w-11 h-11 flex-shrink-0 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 transition-all duration-300"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onShare}
          aria-label="Share profile"
          className="w-11 h-11 flex-shrink-0 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 transition-all duration-300"
        >
          <Share2 className="w-4 h-4" />
        </button>
        {!isOwnProfile && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:border-gray-300 transition-all duration-300"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-40 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setReportOpen(true)
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150"
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  disabled={blockBusy}
                  className="w-full text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-all duration-150 disabled:opacity-50"
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
