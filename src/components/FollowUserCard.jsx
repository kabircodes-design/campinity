import { useNavigate } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'

/**
 * `user` is a resolved profile object from useFollowList.js:
 *   { uid, displayName, username, avatar, verifiedCampus, ... }
 */
export default function FollowUserCard({ user }) {
  const navigate = useNavigate()

  if (!user) return null

  const displayName = user.displayName || 'Student'

  return (
    <button
      type="button"
      onClick={() => navigate(`/student/${user.username}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <Avatar
        initials={getInitials(displayName)}
        colorClass={getAvatarColor(user.uid)}
        size="md"
        src={user.avatar || undefined}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          {user.verifiedCampus && <BadgeCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
        </div>
        <p className="text-xs text-gray-400 truncate">@{user.username}</p>
      </div>
    </button>
  )
}