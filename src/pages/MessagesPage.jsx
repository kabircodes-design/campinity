import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MoreVertical, Search, Users } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ChatCard from '../components/ChatCard.jsx'
import EmptyChat from '../components/EmptyChat.jsx'
import Loader from '../auth/components/Loader.jsx'
import CreateGroupFlow from '../messaging/CreateGroupFlow.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats, subscribeToSentPendingChats, subscribeToMessageRequests } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

export default function MessagesPage() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [sentPendingChats, setSentPendingChats] = useState([])
  const [incomingRequestCount, setIncomingRequestCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
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
            .then((profile) => {
              if (profile) {
                setProfiles((prev) => ({ ...prev, [chat.otherUid]: profile }))
              }
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

    // Second, separate subscription — chats I sent a request for that
    // haven't been accepted yet. subscribeToUserChats only shows
    // 'accepted' chats by design (that's the actual inbox); without
    // this, a chat I created and am actively sending messages in
    // (allowed while pending, since I'm the requester) would never
    // appear in any list here — only reachable by already knowing its
    // exact chatId. Kept in separate state rather than merged into
    // `chats`, so ChatCard.jsx can show "Message Request Sent" instead
    // of treating it identically to an accepted conversation.
    const unsubscribeSent = subscribeToSentPendingChats(uid, (data) => {
      const safeSent = Array.isArray(data) ? data.filter(Boolean) : []
      setSentPendingChats(safeSent)

      safeSent.forEach((chat) => {
        if (!chat?.otherUid || fetchedUidsRef.current.has(chat.otherUid)) return
        fetchedUidsRef.current.add(chat.otherUid)

        getUserProfile(chat.otherUid)
          .then((profile) => {
            if (profile) {
              setProfiles((prev) => ({ ...prev, [chat.otherUid]: profile }))
            }
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

  // Chat-only search — filters the already-loaded allChats list
  // locally using data already in this component's own state
  // (profiles map + each chat's own fields). No new Firestore query,
  // no connection to the app's global Search page.
  const normalizedSearch = chatSearchTerm.trim().toLowerCase()
  const visibleChats = normalizedSearch
    ? allChats.filter((chat) => {
        if (chat.type === 'group') {
          return (chat.groupName || '').toLowerCase().includes(normalizedSearch)
        }
        const profile = profiles[chat.otherUid]
        const nameMatch = (profile?.displayName || '').toLowerCase().includes(normalizedSearch)
        const usernameMatch = (profile?.username || '').toLowerCase().includes(normalizedSearch)
        const lastMessageMatch = (chat.lastMessage || '').toLowerCase().includes(normalizedSearch)
        return nameMatch || usernameMatch || lastMessageMatch
      })
    : allChats

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
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
              onClick={() => navigate('/home')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 flex-1">Messages</span>
            <button
              type="button"
              onClick={() => navigate('/messages/requests')}
              className="flex-shrink-0 flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 transition-all duration-300"
            >
              Requests
              {incomingRequestCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {incomingRequestCount}
                </span>
              )}
            </button>

            <div className="relative flex-shrink-0">
              <button
                type="button"
                aria-label="More options"
                onClick={() => setMenuOpen((v) => !v)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 w-44 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setCreateGroupOpen(true)
                    }}
                    className="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Users className="w-4 h-4 text-gray-400" />
                    Create Group
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={chatSearchTerm}
              onChange={(event) => setChatSearchTerm(event.target.value)}
              placeholder="Search chats..."
              aria-label="Search chats"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>
        </div>

        <main className="pb-24">
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
                <ChatCard key={chat.id} chat={chat} profile={profiles[chat.otherUid]} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
      <CreateGroupFlow open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
    </div>
  )
}
