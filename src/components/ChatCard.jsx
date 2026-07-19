import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import OnlineDot from './OnlineDot.jsx'

export default function ChatCard({ conversation }) {
  const navigate = useNavigate()
  const hasUnread = conversation.unreadCount > 0

  return (
    <button
      type="button"
      onClick={() => navigate(`/messages/${conversation.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <div className="relative flex-shrink-0">
        <Avatar initials={conversation.initials} colorClass={conversation.colorClass} size="md" />
        {conversation.isOnline && <OnlineDot className="w-3 h-3 absolute bottom-0 right-0" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{conversation.name}</p>
          <span className="text-[11px] text-gray-400 flex-shrink-0">{conversation.lastMessageTime}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`text-xs truncate ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {conversation.lastMessage}
          </p>
          {hasUnread && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}