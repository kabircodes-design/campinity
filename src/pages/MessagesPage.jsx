import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, MessageSquarePlus } from 'lucide-react'
import ChatListPanel from '../components/ChatListPanel.jsx'
import Loader from '../auth/components/Loader.jsx'
import CreateGroupFlow from '../messaging/CreateGroupFlow.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats, subscribeToSentPendingChats, subscribeToMessageRequests } from '../firebase/chatService.js'
import { getProfilesByUids } from '../hooks/useAuthorEnrichment.js'

/**
 * Now rendered inside AppShell's <Outlet/> (see App.jsx's layout-route
 * grouping and AppShell.jsx) — the sidebar, global header and bottom
 * nav that used to live directly in this file are gone from here
 * entirely; AppShell owns them once, persistently, across navigation.
 * This file now owns exactly what's actually page-specific: the chat
 * list + placeholder. Own profile/unread-count fetches are gone too —
 * this page never used its own `profile` for anything but the header
 * avatar, which no longer lives here.
 *
 * `h-screen lg:h-full`: on mobile, AppShell's own wrapper is
 * deliberately NOT height-constrained (see AppShell.jsx's comment —
 * that's what keeps Home/Communities/Marketplace/Lost & Found's normal
 * mobile document-scroll behavior unchanged), so Messages asserts its
 * own fixed-viewport height directly here, exactly as it always has,
 * for the fixed-composer requirement from the original scroll-bug fix.
 * On desktop, AppShell's flex column IS height-constrained, so `h-full`
 * correctly fills the exact remaining space below its header.
 */
export default function MessagesPage() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [sentPendingChats, setSentPendingChats] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [chatSearchTerm, setChatSearchTerm] = useState('')

  // Shared/deduped author-profile cache (useAuthorEnrichment.js) instead
  // of a page-local getUserProfile()-per-chat fetch+ref — same
  // mechanism Home/Profile/Comments/Notifications already use, and the
  // one that's kept live-fresh for the current user (see
  // primeAuthorCache in useAuthUser.js), so "I changed my photo" now
  // also propagates to Messages without a hard refresh, without this
  // file needing its own invalidation logic. Calling it again with an
  // already-cached uid is cheap (no re-fetch), so this can just run on
  // every chats update rather than tracking "have I already fetched
  // this uid" itself.
  useEffect(() => {
    const otherUids = [...chats, ...sentPendingChats, ...incomingRequests].map((chat) => chat?.otherUid).filter(Boolean)
    if (otherUids.length === 0) return
    getProfilesByUids(otherUids).then((profileByUid) => {
      const next = {}
      profileByUid.forEach((profile, uid) => {
        if (profile) next[uid] = profile
      })
      setProfiles((prev) => ({ ...prev, ...next }))
    })
  }, [chats, sentPendingChats, incomingRequests])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    const unsubscribe = subscribeToUserChats(
      uid,
      (data) => {
        setChats(Array.isArray(data) ? data.filter(Boolean) : [])
        setLoading(false)
      },
      (err) => {
        console.error('Failed to subscribe to chats:', err)
        setError(err?.message || 'Could not load your messages.')
        setLoading(false)
      }
    )

    const unsubscribeSent = subscribeToSentPendingChats(uid, (data) => {
      setSentPendingChats(Array.isArray(data) ? data.filter(Boolean) : [])
    })

    return () => {
      unsubscribe()
      unsubscribeSent()
    }
  }, [])

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    const unsubscribe = subscribeToMessageRequests(uid, (data) => {
      setIncomingRequests(Array.isArray(data) ? data.filter(Boolean) : [])
    })
    return unsubscribe
  }, [])

  const allChats = [
    ...chats,
    ...sentPendingChats.map((chat) => ({ ...chat, isPendingSent: true }))
  ].sort((a, b) => {
    const aMs = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0
    const bMs = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0
    return bMs - aMs
  })

  // All = every conversation in the list (including requests you sent);
  // Messages = accepted conversations only; Requests = incoming
  // requests (rendered by ChatListPanel from incomingRequests) plus the
  // ones you sent that are still pending.
  const currentUid = auth.currentUser?.uid
  const filteredChats =
    activeFilter === 'messages'
      ? allChats.filter((chat) => !chat.isPendingSent)
      : activeFilter === 'requests'
        ? allChats.filter((chat) => chat.isPendingSent)
        : allChats
  const unreadChatCount = chats.filter((chat) => (chat.unreadCount?.[currentUid] || 0) > 0).length
  const filters = [
    { key: 'all', label: 'All', count: allChats.length },
    { key: 'messages', label: 'Messages', count: unreadChatCount, highlight: true },
    { key: 'requests', label: 'Requests', count: incomingRequests.length, highlight: true }
  ]

  const normalizedSearch = chatSearchTerm.trim().toLowerCase()
  const matchesSearch = (chat) => {
    const p = profiles[chat.otherUid]
    return (
      (p?.displayName || '').toLowerCase().includes(normalizedSearch) ||
      (p?.username || '').toLowerCase().includes(normalizedSearch) ||
      (chat.lastMessage || '').toLowerCase().includes(normalizedSearch)
    )
  }
  const visibleRequests = normalizedSearch ? incomingRequests.filter(matchesSearch) : incomingRequests
  const visibleChats = normalizedSearch
    ? filteredChats.filter((chat) => {
        if (chat.type === 'group') {
          return (chat.groupName || '').toLowerCase().includes(normalizedSearch)
        }
        const p = profiles[chat.otherUid]
        const nameMatch = (p?.displayName || '').toLowerCase().includes(normalizedSearch)
        const usernameMatch = (p?.username || '').toLowerCase().includes(normalizedSearch)
        const lastMessageMatch = (chat.lastMessage || '').toLowerCase().includes(normalizedSearch)
        return nameMatch || usernameMatch || lastMessageMatch
      })
    : filteredChats

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  return (
    <>
      {/* Mobile: normal page scroll (a fixed-height, overflow-hidden
          wrapper here used to clip any conversation below the fold).
          Desktop keeps the fixed-height two-column layout. */}
      <div className="min-h-screen lg:min-h-0 lg:h-full flex flex-col lg:overflow-hidden">
        <div className="flex-1 flex lg:overflow-hidden min-h-0">
          <div className="w-full lg:w-[360px] lg:flex-shrink-0 lg:h-full lg:overflow-y-auto lg:border-r lg:border-gray-100 bg-white">
            <div className="px-4 pt-5 pb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Messages</h1>
                <p className="mt-0.5 text-[13px] text-gray-500">Stay connected with your campus</p>
              </div>
              <button
                type="button"
                aria-label="New group"
                onClick={() => setCreateGroupOpen(true)}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all duration-200"
              >
                <MessageSquarePlus className="w-5 h-5" />
              </button>
            </div>

            <ChatListPanel
              error={error}
              allChats={filteredChats}
              visibleChats={visibleChats}
              profiles={profiles}
              searchTerm={chatSearchTerm}
              onSearchChange={setChatSearchTerm}
              onOpenRequests={() => navigate('/messages/requests')}
              incomingRequestCount={incomingRequests.length}
              filters={filters}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              requests={activeFilter === 'requests' ? visibleRequests : []}
            />
          </div>

          {/* Desktop content placeholder — no conversation is active
              at this route. Real, honest state, not a blank area. */}
          <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-500" />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900">Your conversations start here.</p>
              <p className="mt-1 text-sm text-gray-400">Pick a chat from the left to start messaging.</p>
            </div>
          </div>
        </div>
      </div>

      <CreateGroupFlow open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
    </>
  )
}
