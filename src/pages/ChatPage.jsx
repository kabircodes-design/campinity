import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import MessageBubble from '../components/MessageBubble.jsx'
import MessageInput from '../components/MessageInput.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
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
 * The pending-status badge below is the real gap confirmed by direct
 * audit last pass — this file previously existed only as pasted text
 * with no pending/waiting-for-acceptance UI at all, per "the sender
 * must never lose access... and see the waiting state."
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/messages')}
              className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
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

        <main className="px-4 py-4 space-y-3 pb-32">
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

        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-[480px] lg:max-w-[520px] bg-white/95 backdrop-blur-md border-t border-gray-100">
          {pendingLimitReached ? (
            <p className="px-4 py-3.5 text-center text-xs text-gray-400">
              You've sent your message — you can reply again once they accept.
            </p>
          ) : (
            <MessageInput onSend={sendMessage} disabled={sending} />
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
