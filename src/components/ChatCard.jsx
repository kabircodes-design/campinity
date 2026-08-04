import { useNavigate } from 'react-router-dom'
import { Pin, VolumeX } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials, formatTimeAgo } from '../firebase/postService.js'
import { auth } from '../firebase/firebase.js'

/**
 * Props match MessagesPage.jsx's usage: <ChatCard chat={chat}
 * profile={profiles[chat.otherUid]} />. profile can be undefined
 * briefly (MessagesPage.jsx fetches profiles asynchronously after the
 * chat list arrives) — handled with a "Student" fallback, not a crash.
 */
export default function ChatCard({ chat, profile }) {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid

  const displayName = profile?.displayName || 'Student'
  const isPinned = (chat.pinnedBy || []).includes(uid)
  const isMuted = (chat.mutedBy || []).includes(uid)
  const isUnread = chat.lastMessage && chat.lastSenderId !== uid && !(chat.readBy || []).includes(uid)

  return (
    <button
      type="button"
      onClick={() => navigate(`/messages/${chat.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-all duration-200"
    >
      <Avatar
        initials={getInitials(displayName)}
        colorClass={getAvatarColor(chat.otherUid || chat.id)}
        size="md"
        src={profile?.avatar || undefined}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
            {displayName}
          </p>
          {isPinned && <Pin className="w-3 h-3 text-gray-300 flex-shrink-0" fill="currentColor" />}
          {isMuted && <VolumeX className="w-3 h-3 text-gray-300 flex-shrink-0" />}
        </div>
        <p className={`text-xs truncate ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
          {chat.isPendingSent ? 'Message Request Sent' : chat.lastMessage || 'Say hello 👋'}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px] text-gray-400">{formatTimeAgo(chat.lastMessageAt)}</span>
        {isUnread && <span className="w-2 h-2 rounded-full bg-blue-600" aria-hidden="true" />}
      </div>
    </button>
  )
}
