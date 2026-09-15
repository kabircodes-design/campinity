import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, MessageSquarePlus } from 'lucide-react'
import ChatListPanel from '../components/ChatListPanel.jsx'
import Loader from '../auth/components/Loader.jsx'
import CreateGroupFlow from '../messaging/CreateGroupFlow.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats, subscribeToSentPendingChats, subscribeToMessageRequests } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

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
  const [incomingRequestCount, setIncomingRequestCount] = useState(0)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [chatSearchTerm, setChatSearchTerm] = useState('')
  const fetchedUidsRef = useRef(new Set())

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
        const safeChats = Array.isArray(data) ? data.filter(Boolean) : []
        setChats(safeChats)
        setLoading(false)

        safeChats.forEach((chat) => {
          if (!chat?.otherUid || fetchedUidsRef.current.has(chat.otherUid)) return
          fetchedUidsRef.current.add(chat.otherUid)
          getUserProfile(chat.otherUid)
            .then((p) => {
              if (p) setProfiles((prev) => ({ ...prev, [chat.otherUid]: p }))
            })
            .catch(() => {})
        })
      },
      (err) => {
        console.error('Failed to subscribe to chats:', err)
        setError(err?.message || 'Could not load your messages.')
        setLoading(false)
      }
    )

    const unsubscribeSent = subscribeToSentPendingChats(uid, (data) => {
      const safeSent = Array.isArray(data) ? data.filter(Boolean) : []
      setSentPendingChats(safeSent)
      safeSent.forEach((chat) => {
        if (!chat?.otherUid || fetchedUidsRef.current.has(chat.otherUid)) return
        fetchedUidsRef.current.add(chat.otherUid)
        getUserProfile(chat.otherUid)
          .then((p) => {
            if (p) setProfiles((prev) => ({ ...prev, [chat.otherUid]: p }))
          })
          .catch(() => {})
      })
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
      setIncomingRequestCount(Array.isArray(data) ? data.length : 0)
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

  const normalizedSearch = chatSearchTerm.trim().toLowerCase()
  const visibleChats = normalizedSearch
    ? allChats.filter((chat) => {
        if (chat.type === 'group') {
          return (chat.groupName || '').toLowerCase().includes(normalizedSearch)
        }
        const p = profiles[chat.otherUid]
        const nameMatch = (p?.displayName || '').toLowerCase().includes(normalizedSearch)
        const usernameMatch = (p?.username || '').toLowerCase().includes(normalizedSearch)
        const lastMessageMatch = (chat.lastMessage || '').toLowerCase().includes(normalizedSearch)
        return nameMatch || usernameMatch || lastMessageMatch
      })
    : allChats

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  return (
    <>
      <div className="h-screen lg:h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex lg:overflow-hidden min-h-0">
          <div className="w-full lg:w-[360px] lg:flex-shrink-0 lg:h-full lg:overflow-y-auto lg:border-r lg:border-gray-100 bg-white">
            <div className="px-4 pt-4 pb-1 flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Messages</h1>
              <button
                type="button"
                aria-label="New group"
                onClick={() => setCreateGroupOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all duration-200"
              >
                <MessageSquarePlus className="w-4.5 h-4.5" />
              </button>
            </div>

            <ChatListPanel
              error={error}
              allChats={allChats}
              visibleChats={visibleChats}
              profiles={profiles}
              searchTerm={chatSearchTerm}
              onSearchChange={setChatSearchTerm}
              onOpenRequests={() => navigate('/messages/requests')}
              incomingRequestCount={incomingRequestCount}
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
