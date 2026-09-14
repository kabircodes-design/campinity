import { Inbox, Search } from 'lucide-react'
import ChatCard from './ChatCard.jsx'
import EmptyChat from './EmptyChat.jsx'

/**
 * Pure presentational extraction from MessagesPage.jsx's existing
 * list-rendering JSX — zero data-fetching logic here, all state
 * (chats, profiles, search term) is owned by the caller and passed
 * down as props. This is what lets both MessagesPage.jsx (mobile: the
 * only panel; desktop: middle column) and ChatPage.jsx (desktop list
 * column) render the identical list without duplicating the actual
 * list-item JSX — only each page's own data subscription differs.
 *
 * "Message Requests" is now a full prominent row (not a small pill)
 * directly under search — this is deliberately the slot a Stories row
 * would otherwise occupy on this page, per the explicit "no Stories in
 * Messages, use Message Requests instead" instruction.
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
  activeChatId
}) {
  return (
    <>
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
          />
        </div>
      </div>

      {onOpenRequests && (
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={onOpenRequests}
            className="w-full flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 text-left hover:bg-blue-50/60 hover:border-blue-100 transition-all duration-200"
          >
            <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Inbox className="w-4 h-4" />
            </span>
            <span className="flex-1 text-sm font-semibold text-gray-900">Message Requests</span>
            {incomingRequestCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                {incomingRequestCount}
              </span>
            )}
          </button>
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
                    ? 'bg-blue-50/70 border-l-[3px] border-blue-600'
                    : 'border-l-[3px] border-transparent'
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
