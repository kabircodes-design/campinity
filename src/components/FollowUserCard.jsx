import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { followUser, unfollowUser } from '../firebase/profileService.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'

/**
 * Real implementation — referenced by FollowersPage.jsx/FollowingPage.jsx
 * but never shown to me. `user` prop shape matches getFollowListPage's
 * real return: { uid, displayName, username, avatar, verifiedCampus,
 * ...rest of getUserProfile's shape }.
 */
export default function FollowUserCard({ user, mutualCount = 0 }) {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [isFollowing, setIsFollowing] = useState(Boolean(user.viewerIsFollowing))
  const [busy, setBusy] = useState(false)

  const isSelf = user.uid === currentUid

  const handleFollowClick = async (event) => {
    event.stopPropagation()
    if (!currentUid || busy) return
    setBusy(true)
    const next = !isFollowing
    setIsFollowing(next)
    try {
      if (next) {
        await followUser(currentUid, user.uid)
      } else {
        await unfollowUser(currentUid, user.uid)
      }
    } catch {
      setIsFollowing(!next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/student/${user.username}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') navigate(`/student/${user.username}`)
      }}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-all duration-200 cursor-pointer"
    >
      <Avatar
        initials={getInitials(user.displayName)}
        colorClass={getAvatarColor(user.uid)}
        size="md"
        src={user.avatar || undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
          {user.verifiedCampus && (
            <BadgeCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="currentColor" fillOpacity={0.15} />
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">@{user.username}</p>
        {mutualCount > 0 && (
          <p className="text-[11px] text-gray-400 mt-0.5">Followed by {mutualCount} you follow</p>
        )}
      </div>

      {!isSelf && (
        <button
          type="button"
          onClick={handleFollowClick}
          disabled={busy}
          className={`flex-shrink-0 rounded-full text-xs font-semibold px-4 py-2 transition-all duration-300 disabled:opacity-60 ${
            isFollowing
              ? 'border border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {busy ? '...' : isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  )
}
