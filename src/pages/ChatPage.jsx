import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Flag,
  MoreVertical,
  Phone,
  UserX,
  Users,
  Video
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import ChatListPanel from '../components/ChatListPanel.jsx'
import MessageBubble from '../components/MessageBubble.jsx'
import MessageInput from '../components/MessageInput.jsx'
import TypingIndicator from '../components/TypingIndicator.jsx'
import ReportModal from '../components/ReportModal.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import {
  markChatRead,
  subscribeToUserChats,
  subscribeToSentPendingChats,
  toggleMessageReaction,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone
} from '../firebase/chatService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { subscribeToUnreadCount } from '../firebase/notificationService.js'
import { isOnline, presenceLabel } from '../firebase/presenceService.js'
import { blockUser } from '../firebase/blockService.js'
import { useChat } from '../hooks/useChat.js'
import { useMessages } from '../hooks/useMessages.js'
import { useCallActions } from '../context/CallContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

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
 * Redesigned to match the finished Home page's design system, PLUS a
 * real fix for the reported scroll/composer bug: the previous version
 * only applied `overflow-y-auto` to the messages region (and
 * `overflow-hidden`/`h-screen` on its ancestor) at the `lg:` breakpoint
 * — on mobile there was no such constraint, so the whole PAGE scrolled
 * as one long document instead of just the message list, which is
 * exactly what made the composer "move away" while scrolling and
 * required manually scrolling down to reach the latest message. Fixed
 * by applying `h-screen overflow-hidden` on the conversation column and
 * `overflow-y-auto` on the message list at every breakpoint, not just
 * lg:. The actual scroll-to-bottom / "near bottom vs. show new-messages
 * button" / composer-stays-fixed LOGIC below was already correct
 * (confirmed by reading it) — only this CSS constraint was missing.
 */
export default function ChatPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)

  const { chat, otherProfile, otherUid, loading: chatLoading, error: chatError } = useChat(chatId)
  const { messages, loading: messagesLoading, error: messagesError, sending, sendMessage, retryMessage } = useMessages(
    chatId,
    otherUid
  )
  const { startCall, isBusy } = useCallActions()

  const [listChats, setListChats] = useState([])
  const [listSentPending, setListSentPending] = useState([])
  const [listProfiles, setListProfiles] = useState({})
  const [listSearchTerm, setListSearchTerm] = useState('')
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [reportOpen, setReportOpen] = useState(false)
  const [chatMenuOpen, setChatMenuOpen] = useState(false)
  const chatMenuRef = useRef(null)
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

  const { profile } = useAuth()

  useEffect(() => {
    const uid = auth.currentUser?.uid
    const unsubscribe = subscribeToUnreadCount(uid, setUnreadNotifCount)
    return () => unsubscribe()
  }, [])

  const messagesContainerRef = useRef(null)
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false)
  const isNearBottomRef = useRef(true)
  const [replyingTo, setReplyingTo] = useState(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const highlightTimeoutRef = useRef(null)

  // Clears the reply draft on chat switch — otherwise replying in chat A
  // then navigating to chat B without sending would silently carry the
  // reply-to reference into the wrong conversation.
  useEffect(() => {
    setReplyingTo(null)
  }, [chatId])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  // "Jump to original" only works for messages already loaded in this
  // page's real-time subscription (subscribeToMessages' own pageSize) —
  // reaching further back would need fetching older pages until found,
  // deliberately out of scope here. If it's not in the DOM, this is a
  // safe, silent no-op rather than a broken jump.
  const handleJumpToMessage = (messageId) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    setHighlightedMessageId(messageId)
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 1500)
  }

  const handleReact = (messageId, emoji) => {
    if (!currentUid) return
    toggleMessageReaction(chatId, messageId, currentUid, emoji).catch(() => {})
  }

  const handleEdit = (messageId, newText) => {
    if (!currentUid) return
    editMessage(chatId, messageId, currentUid, newText).catch(() => {})
  }

  const handleDeleteForMe = (messageId) => {
    if (!currentUid) return
    deleteMessageForMe(chatId, messageId, currentUid).catch(() => {})
  }

  const handleDeleteForEveryone = (messageId) => {
    if (!currentUid) return
    deleteMessageForEveryone(chatId, messageId, currentUid).catch(() => {})
  }

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearBottom = distanceFromBottom < 120
    isNearBottomRef.current = nearBottom
    if (nearBottom) setShowNewMessagesButton(false)
  }

  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
    setShowNewMessagesButton(false)
  }

  // Opening a conversation (or switching to a new one) always starts at
  // the latest message — isNearBottomRef defaults to true and this
  // effect fires the first time `messages` populates, same mechanism
  // that also handles new incoming messages while already at the
  // bottom. Only skips the jump if the user has manually scrolled up.
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      setShowNewMessagesButton(true)
    }
  }, [messages])

  // Reset scroll tracking when switching conversations, so opening chat
  // B right after chat A doesn't inherit "user had scrolled up" from A.
  useEffect(() => {
    isNearBottomRef.current = true
    setShowNewMessagesButton(false)
  }, [chatId])

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
  const initials = getInitials(profile?.displayName || '')
  const myColorClass = getAvatarColor(currentUid || profile?.displayName)

  const isPending = chat?.status === 'pending'
  const isMyRequest = isPending && chat?.requestedBy === currentUid
  const pendingLimitReached = isMyRequest && (chat?.pendingMessageCount || 0) >= 1
  const otherOnline = !isGroup && isOnline(otherProfile)

  const handleCall = (type) => {
    // isBusy also guards against rapid double-clicks starting two
    // overlapping calls — startCall() itself no-ops once already
    // mid-call, but disabling the button is what stops the SPAM case
    // (many rapid clicks before the first click's state update lands).
    if (isGroup || !otherUid || isBusy) return
    startCall(otherUid, chatId, type)
  }

  // Chat header "..." menu (Report/Block) — replaces the removed
  // right-side info rail's own Safety section. Same real
  // handleBlock/setReportOpen this page already had; only where they're
  // triggered from changed.
  useEffect(() => {
    if (!chatMenuOpen) return undefined
    const handleOutside = (event) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target)) setChatMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [chatMenuOpen])

  // Instagram/Facebook-style: tap the header identity to open that
  // person's real profile — the existing /student/:username route,
  // nothing new. React Router push, not a reload, so the browser Back
  // button returns straight to this exact conversation (chatId in the
  // URL is untouched by this navigation, and useChat/useMessages
  // re-subscribe correctly on remount the same way opening the chat
  // fresh already does).
  const handleOpenOtherProfile = () => {
    if (isGroup || !otherProfile?.username) return
    navigate(`/student/${otherProfile.username}`)
  }

  const handleBlock = async () => {
    if (!currentUid || !otherUid) return
    await blockUser(currentUid, otherUid).catch(() => {})
    navigate('/messages')
  }

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
    <>
      <div
        className="relative overflow-x-hidden lg:grid lg:h-screen lg:overflow-hidden lg:[grid-template-columns:minmax(240px,280px)_1fr]"
        style={{ backgroundColor: '#f8fafc' }}
      >
        <DesktopSidebar unreadNotifications={unreadNotifCount} profile={profile} />

        <div className="flex flex-col h-screen overflow-hidden min-w-0">
          {/* No page-specific desktop header here (deliberately, per a
              layout-bug fix) — it used to duplicate DesktopSidebar's own
              logo/nav one row down, showing two Campinity logos and two
              search bars on desktop at once. DesktopSidebar already
              covers navigation; the active conversation's own header
              below covers this page's specific chat context. */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Desktop chat-list column — same panel MessagesPage.jsx uses. */}
            <div className="hidden lg:flex lg:flex-col w-[320px] flex-shrink-0 h-full border-r border-gray-100 bg-white overflow-y-auto">
              <div className="px-4 pt-4 pb-1">
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Messages</h2>
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

            {/* Active conversation — real flex-column, h-full +
                overflow-hidden at every breakpoint (not just lg:), which
                is the actual fix for "composer moves / have to scroll
                down manually" on mobile. */}
            <div className="flex-1 h-screen lg:h-full overflow-hidden flex flex-col min-w-0 bg-white">
              <header className="sticky top-0 z-30 bg-white border-b border-gray-100 flex-shrink-0">
                <div className="h-14 flex items-center gap-2 px-3">
                  <button
                    type="button"
                    aria-label="Back"
                    onClick={() => navigate('/messages')}
                    className="lg:hidden w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-200"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  {isGroup ? (
                    <button type="button" onClick={() => navigate(`/messages/${chatId}/info`)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
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
                      {/* Instagram/Facebook-style tap-to-open-profile —
                          same identity block, just wrapped in a button
                          instead of a static div. cursor-pointer +
                          hover bg gives it real desktop affordance. */}
                      <button
                        type="button"
                        onClick={handleOpenOtherProfile}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-gray-50 transition-all duration-200 cursor-pointer"
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar
                            initials={getInitials(displayName)}
                            colorClass={getAvatarColor(otherUid || chatId)}
                            size="sm"
                            src={getProfileIdentityImage(otherProfile) || undefined}
                          />
                          {otherOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" aria-label="Online" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                          <p className={`text-[11px] truncate ${otherOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {presenceLabel(otherProfile)}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label="Voice call"
                        title="Voice call"
                        onClick={() => handleCall('voice')}
                        disabled={isBusy}
                        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200"
                      >
                        <Phone className="w-4.5 h-4.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Video call"
                        title="Video call"
                        onClick={() => handleCall('video')}
                        disabled={isBusy}
                        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200"
                      >
                        <Video className="w-4.5 h-4.5" />
                      </button>
                      {/* Report/Block — the old right rail's own Safety
                          section, moved here (same handleBlock/
                          setReportOpen, same ReportModal already
                          rendered at the bottom of this page). z-40, not
                          the previous rail's implied z-30-and-under: see
                          ProfileHeader.jsx's identical fix for why an
                          open dropdown must clear a page's sticky
                          elements, not just happen to not collide. */}
                      <div className="relative flex-shrink-0" ref={chatMenuRef}>
                        <button
                          type="button"
                          aria-label="More options"
                          onClick={() => setChatMenuOpen((v) => !v)}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-200"
                        >
                          <MoreVertical className="w-4.5 h-4.5" />
                        </button>
                        {chatMenuOpen && (
                          <div className="absolute right-0 top-11 w-40 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-40">
                            <button
                              type="button"
                              onClick={() => {
                                setChatMenuOpen(false)
                                setReportOpen(true)
                              }}
                              className="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150"
                            >
                              <Flag className="w-3.5 h-3.5 text-gray-400" /> Report
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setChatMenuOpen(false)
                                handleBlock()
                              }}
                              className="w-full flex items-center gap-2 text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-all duration-150"
                            >
                              <UserX className="w-3.5 h-3.5" /> Block
                            </button>
                          </div>
                        )}
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

              <main
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3"
              >
                {messagesError && <p className="text-center text-xs text-red-500">{messagesError}</p>}

                {groupedMessages.length === 0 ? (
                  <p className="py-12 text-center text-sm text-gray-400">Say hello 👋</p>
                ) : (
                  groupedMessages.map((item) =>
                    item.type === 'separator' ? (
                      <div key={item.id} className="flex items-center justify-center py-2">
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                          {item.label}
                        </span>
                      </div>
                    ) : (
                      <MessageBubble
                        key={item.id}
                        message={item.message}
                        isMine={item.message.senderId === currentUid}
                        currentUid={currentUid}
                        onRetry={retryMessage}
                        onReply={setReplyingTo}
                        onReact={handleReact}
                        onEdit={handleEdit}
                        onDeleteForMe={handleDeleteForMe}
                        onDeleteForEveryone={handleDeleteForEveryone}
                        onJumpToMessage={handleJumpToMessage}
                        highlighted={highlightedMessageId === item.message.id}
                      />
                    )
                  )
                )}
                <div ref={bottomRef} />
              </main>

              {showNewMessagesButton && (
                <div className="relative flex-shrink-0 flex justify-center -mt-14 mb-2 pointer-events-none">
                  <button
                    type="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-gray-900 text-white text-xs font-semibold px-3.5 py-2 shadow-lg hover:bg-gray-800 transition-all duration-200"
                  >
                    ↓ New messages
                  </button>
                </div>
              )}

              <TypingIndicator
                chatId={chatId}
                currentUid={currentUid}
                otherDisplayName={!isGroup ? otherProfile?.displayName : undefined}
              />

              <div className="flex-shrink-0 border-t border-gray-100 bg-white pb-16 lg:pb-[env(safe-area-inset-bottom)]">
                {pendingLimitReached ? (
                  <p className="px-4 py-3.5 text-center text-xs text-gray-400">
                    You've sent your message — you can reply again once they accept.
                  </p>
                ) : (
                  <MessageInput
                    onSend={sendMessage}
                    disabled={sending}
                    chatId={chatId}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={otherUid} targetOwnerUid={otherUid} />
    </>
  )
}
