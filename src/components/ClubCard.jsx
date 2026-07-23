import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials, formatTimeAgo } from '../firebase/postService.js'

/**
 * `chat` comes from chatService.js's subscribeToUserChats():
 *   { id, otherUid, lastMessage, lastMessageAt, unreadCount }
 * `profile` comes from profileService.js's getUserProfile(otherUid), and
 * may be undefined for a brief moment while it's still loading — this
 * renders a safe placeholder in that case rather than crashing.
 *
 * No online indicator is rendered — there's no real presence system
 * backing it, and showing a fabricated online/offline dot would be
 * exactly the kind of dummy shortcut this feature avoids.
 */
export default function ChatCard({ chat, profile }) {
  const navigate = useNavigate()
  const hasUnread = chat.unreadCount > 0
  const displayName = profile?.displayName || 'Student'

  return (
    <button
      type="button"
      onClick={() => navigate(`/messages/${chat.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <Avatar
        initials={getInitials(displayName)}
        colorClass={getAvatarColor(chat.otherUid || chat.id)}
        size="md"
        src={profile?.avatar || undefined}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTimeAgo(chat.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {chat.lastMessage || 'Say hello 👋'}
          </p>
          {hasUnread && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}