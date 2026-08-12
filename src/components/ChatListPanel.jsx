import { Search, Users } from 'lucide-react'
import ChatCard from './ChatCard.jsx'
import EmptyChat from './EmptyChat.jsx'

/**
 * Pure presentational extraction from MessagesPage.jsx's existing
 * list-rendering JSX — zero data-fetching logic here, all state
 * (chats, profiles, search term) is owned by the caller and passed
 * down as props. This is what lets both MessagesPage.jsx (mobile: the
 * only panel; desktop: middle column) and, in a later pass, the
 * active-conversation route render the identical list without
 * duplicating the actual list-item JSX — only each page's own data
 * subscription differs.
 */
export default function ChatListPanel({
  error,
  allChats,
  visibleChats,
  profiles,
  searchTerm,
  onSearchChange,
  onOpenRequests,
  incomingRequestCount,
  onOpenCreateGroup,
  activeChatId
}) {
  return (
    <>
      <div className="px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats..."
            aria-label="Search chats"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
          />
        </div>
      </div>

      {(onOpenRequests || onOpenCreateGroup) && (
        <div className="px-4 pb-2 flex items-center gap-2">
          {onOpenRequests && (
            <button
              type="button"
              onClick={onOpenRequests}
              className="flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 transition-all duration-300"
            >
              Requests
              {incomingRequestCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {incomingRequestCount}
                </span>
              )}
            </button>
          )}
          {onOpenCreateGroup && (
            <button
              type="button"
              onClick={onOpenCreateGroup}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 transition-all duration-300"
            >
              <Users className="w-3.5 h-3.5" />
              New Group
            </button>
          )}
        </div>
      )}

      <div className="pb-24 lg:pb-4">
        {error ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        ) : allChats.length === 0 ? (
          <EmptyChat />
        ) : visibleChats.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">No chats found</p>
            <p className="mt-1 text-sm text-gray-400">Try a different name or username.</p>
          </div>
        ) : (
          <div>
            {visibleChats.map((chat) => (
              <div
                key={chat.id}
                className={
                  activeChatId === chat.id
                    ? 'lg:bg-indigo-50/70 lg:border-l-[3px] lg:border-indigo-500 lg:shadow-[0_1px_3px_rgba(79,70,229,0.08)]'
                    : 'lg:border-l-[3px] lg:border-transparent'
                }
              >
                <ChatCard chat={chat} profile={profiles[chat.otherUid]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
