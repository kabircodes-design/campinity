import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import ChatListPanel from '../components/ChatListPanel.jsx'
import MessageBubble from '../components/MessageBubble.jsx'
import MessageInput from '../components/MessageInput.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { markChatRead, subscribeToUserChats, subscribeToSentPendingChats } from '../firebase/chatService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { useChat } from '../hooks/useChat.js'
import { useMessages } from '../hooks/useMessages.js'

function dayLabelFor(timestamp) {
  if (!timestamp?.toDate) return ''
  const date = timestamp.toDate()
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  if (isSameDay(date, today)) return 'Today'
  if (isSameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * Phase 1 foundation change: this page now also renders the desktop
 * 3-column shell (sidebar + chat list + this active conversation),
 * not just the conversation alone. The chat-list data subscription
 * below (subscribeToUserChats/subscribeToSentPendingChats/profile
 * enrichment) intentionally duplicates MessagesPage.jsx's own — this
 * is a genuine architectural cost of the app's existing two-separate-
 * routes design (/messages vs /messages/:chatId), not something a
 * shared hook could avoid without a much larger routing rewrite this
 * phase's scope explicitly avoids. What's NOT duplicated is the list
 * ITEM markup — both pages render the same ChatListPanel.jsx.
 *
 * The composer was previously position:fixed, centered via
 * left-1/2/translate-x — that only worked because the whole app was a
 * single narrow mobile-width column. In the new 3-column desktop
 * shell it would center on the full viewport instead of the
 * conversation column. Converted to a normal flex-column layout
 * (header, flex-1 scrollable messages, composer as a plain flex
 * child) — this is also what correctly satisfies "composer should
 * remain fixed/sticky at the bottom of the active chat" without the
 * fragile viewport-centering hack.
 */
export default function ChatPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)

  const { chat, otherProfile, otherUid, loading: chatLoading, error: chatError } = useChat(chatId)
  const { messages, loading: messagesLoading, error: messagesError, sending, sendMessage } = useMessages(
    chatId,
    otherUid
  )

  // Desktop chat-list column — see the file-level comment above for
  // why this duplicates MessagesPage.jsx's own subscription.
  const [listChats, setListChats] = useState([])
  const [listSentPending, setListSentPending] = useState([])
  const [listProfiles, setListProfiles] = useState({})
  const [listSearchTerm, setListSearchTerm] = useState('')
  const fetchedUidsRef = useRef(new Set())

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    const unsubscribe = subscribeToUserChats(uid, (data) => {
      const safe = Array.isArray(data) ? data.filter(Boolean) : []
      setListChats(safe)
      safe.forEach((c) => {
        if (!c?.otherUid || fetchedUidsRef.current.has(c.otherUid)) return
        fetchedUidsRef.current.add(c.otherUid)
        getUserProfile(c.otherUid).then((p) => {
          if (p) setListProfiles((prev) => ({ ...prev, [c.otherUid]: p }))
        }).catch(() => {})
      })
    })
    const unsubscribeSent = subscribeToSentPendingChats(uid, (data) => {
      const safe = Array.isArray(data) ? data.filter(Boolean) : []
      setListSentPending(safe)
      safe.forEach((c) => {
        if (!c?.otherUid || fetchedUidsRef.current.has(c.otherUid)) return
        fetchedUidsRef.current.add(c.otherUid)
        getUserProfile(c.otherUid).then((p) => {
          if (p) setListProfiles((prev) => ({ ...prev, [c.otherUid]: p }))
        }).catch(() => {})
      })
    })
    return () => {
      unsubscribe()
      unsubscribeSent()
    }
  }, [])

  const listAllChats = [
    ...listChats,
    ...listSentPending.map((c) => ({ ...c, isPendingSent: true }))
  ].sort((a, b) => {
    const aMs = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0
    const bMs = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0
    return bMs - aMs
  })
  const normalizedListSearch = listSearchTerm.trim().toLowerCase()
  const listVisibleChats = normalizedListSearch
    ? listAllChats.filter((c) => {
        if (c.type === 'group') return (c.groupName || '').toLowerCase().includes(normalizedListSearch)
        const p = listProfiles[c.otherUid]
        return (
          (p?.displayName || '').toLowerCase().includes(normalizedListSearch) ||
          (p?.username || '').toLowerCase().includes(normalizedListSearch) ||
          (c.lastMessage || '').toLowerCase().includes(normalizedListSearch)
        )
      })
    : listAllChats

  const [profile, setProfile] = useState(null)
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getUserProfile(uid).then(setProfile).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid || !chatId) return
    markChatRead(chatId, uid).catch(() => {})
  }, [chatId, messages.length])

  const groupedMessages = useMemo(() => {
    const groups = []
    let lastLabel = null

    messages.forEach((message) => {
      const label = message.pending ? 'Today' : dayLabelFor(message.createdAt) || lastLabel || 'Today'
      if (label !== lastLabel) {
        groups.push({ type: 'separator', id: `sep-${message.id}`, label })
        lastLabel = label
      }
      groups.push({ type: 'message', id: message.id, message })
    })

    return groups
  }, [messages])

  const loading = chatLoading || (messagesLoading && messages.length === 0)
  const displayName = otherProfile?.displayName || 'Student'
  const isGroup = chat?.type === 'group'
  const currentUid = auth.currentUser?.uid

  const isPending = chat?.status === 'pending'
  const isMyRequest = isPending && chat?.requestedBy === currentUid
  const pendingLimitReached = isMyRequest && (chat?.pendingMessageCount || 0) >= 3

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (chatError) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">{chatError}</p>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back to Messages
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden">
      <DesktopSidebar profile={profile} />

      {/* Desktop chat-list column — same panel MessagesPage.jsx uses */}
      <div className="hidden lg:flex lg:flex-col w-[380px] flex-shrink-0 h-screen border-r border-gray-100 overflow-y-auto">
        <div className="h-14 flex items-center px-4 flex-shrink-0 border-b border-gray-100">
          <span className="text-base font-bold tracking-tight text-gray-900">Chats</span>
        </div>
        <ChatListPanel
          error=""
          allChats={listAllChats}
          visibleChats={listVisibleChats}
          profiles={listProfiles}
          searchTerm={listSearchTerm}
          onSearchChange={setListSearchTerm}
          activeChatId={chatId}
        />
      </div>

      {/* Active conversation — a real flex column now, not a
          viewport-fixed composer hack. h-screen/overflow-hidden on
          this column plus flex-1/overflow-y-auto on <main> below is
          what makes only the message history scroll, matching the
          brief's own application-shell requirement. */}
      <div
        className="flex-1 min-h-screen lg:h-screen lg:overflow-hidden overflow-x-hidden bg-gray-50 flex flex-col"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 600px 400px at 20% 0%, rgba(129,140,248,0.05), transparent), radial-gradient(ellipse 500px 400px at 100% 100%, rgba(59,130,246,0.04), transparent)'
        }}
      >
        <div className="mx-auto w-full max-w-[480px] lg:max-w-none lg:h-full bg-white lg:shadow-none flex flex-col flex-1 min-h-screen lg:min-h-0">
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 flex-shrink-0">
            <div className="h-14 flex items-center gap-2 px-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate('/messages')}
                className="lg:hidden w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {isGroup ? (
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${chatId}/info`)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {chat?.groupAvatar ? (
                    <img src={chat.groupAvatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{chat?.groupName || 'Group'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{chat?.participants?.length || 0} members</p>
                  </div>
                </button>
              ) : (
                <>
                  <Avatar
                    initials={getInitials(displayName)}
                    colorClass={getAvatarColor(otherUid || chatId)}
                    size="sm"
                    src={getProfileIdentityImage(otherProfile) || undefined}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    {otherProfile?.username && <p className="text-[11px] text-gray-400 truncate">@{otherProfile.username}</p>}
                  </div>
                </>
              )}
            </div>

            {isMyRequest && (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border-t border-amber-100">
                <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <p className="text-[12px] text-amber-700">
                  <span className="font-semibold">Message Request Sent</span> — waiting for acceptance
                </p>
              </div>
            )}
          </header>

          <main className="flex-1 lg:overflow-y-auto px-4 py-4 space-y-3">
            {messagesError && <p className="text-center text-xs text-red-500">{messagesError}</p>}

            {groupedMessages.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">Say hello 👋</p>
            ) : (
              groupedMessages.map((item) =>
                item.type === 'separator' ? (
                  <div key={item.id} className="flex items-center justify-center py-2">
                    <span className="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <MessageBubble key={item.id} message={item.message} isMine={item.message.senderId === currentUid} currentUid={currentUid} />
                )
              )
            )}
            <div ref={bottomRef} />
          </main>

          <div className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-gray-100 pb-16 lg:pb-0">
            {pendingLimitReached ? (
              <p className="px-4 py-3.5 text-center text-xs text-gray-400">
                You've sent your message — you can reply again once they accept.
              </p>
            ) : (
              <MessageInput onSend={sendMessage} disabled={sending} chatId={chatId} />
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
