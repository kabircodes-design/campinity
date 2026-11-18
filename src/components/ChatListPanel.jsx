import { ChevronRight, Inbox, Search } from 'lucide-react'
import Avatar from './Avatar.jsx'
import ChatCard from './ChatCard.jsx'
import EmptyChat from './EmptyChat.jsx'
import { getAvatarColor, getInitials, formatTimeAgo } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { displayNameOf } from '../identity/identity.js'

/**
 * Pure presentational extraction from MessagesPage.jsx's existing
 * list-rendering JSX — zero data-fetching logic here, all state
 * (chats, profiles, search term) is owned by the caller and passed
 * down as props. This is what lets both MessagesPage.jsx (mobile: the
 * only panel; desktop: middle column) and ChatPage.jsx (desktop list
 * column) render the identical list without duplicating the actual
 * list-item JSX — only each page's own data subscription differs.
 *
 * Two ways to reach message requests, chosen by the caller:
 *  - `filters` (MessagesPage): All / Messages / Requests chips under
 *    search; the Requests chip lists incoming requests inline
 *    (`requests`), each opening the existing Requests page where
 *    accept/decline lives.
 *  - `onOpenRequests` without `filters`: the original full-width
 *    "Message Requests" row.
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
  activeChatId,
  filters,
  activeFilter,
  onFilterChange,
  requests = []
}) {
  const showingRequests = !!filters && activeFilter === 'requests'
  const nothingAtAll = showingRequests ? requests.length === 0 && visibleChats.length === 0 && !searchTerm : allChats.length === 0

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
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
          />
        </div>
      </div>

      {filters && (
        <div className="px-4 pt-1 pb-2 flex items-center gap-2" role="tablist" aria-label="Filter conversations">
          {filters.map((filter) => {
            const isActive = filter.key === activeFilter
            return (
              <button
                key={filter.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onFilterChange(filter.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
                {filter.count > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-white/25 text-white' : filter.highlight ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {filter.count > 99 ? '99+' : filter.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {!filters && onOpenRequests && (
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
        ) : nothingAtAll ? (
          showingRequests ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Inbox className="w-5 h-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">No message requests</p>
              <p className="mt-1 text-sm text-gray-400">Requests from people you don't follow will show up here.</p>
            </div>
          ) : (
            <EmptyChat />
          )
        ) : (
          <div>
            {showingRequests &&
              requests.map((request) => {
                const profile = profiles[request.otherUid]
                const name = displayNameOf(profile)
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={onOpenRequests}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-50 transition-all duration-200"
                  >
                    <Avatar
                      initials={getInitials(name)}
                      colorClass={getAvatarColor(request.otherUid || request.id)}
                      size="md"
                      src={getProfileIdentityImage(profile) || undefined}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-bold text-gray-900 truncate">{name}</span>
                      <span className="block mt-0.5 text-[13px] text-gray-500 truncate">
                        {request.lastMessage || 'Wants to message you'}
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] text-gray-400">{formatTimeAgo(request.lastMessageAt)}</span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600">
                        Review
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </span>
                  </button>
                )
              })}

            {visibleChats.length === 0 && !(showingRequests && requests.length > 0) ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">No chats found</p>
                <p className="mt-1 text-sm text-gray-400">
                  {searchTerm ? 'Try a different name or username.' : 'Nothing here yet.'}
                </p>
              </div>
            ) : (
              visibleChats.map((chat) => (
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
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
