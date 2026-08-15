import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle, MoreVertical, Users } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import ChatListPanel from '../components/ChatListPanel.jsx'
import Loader from '../auth/components/Loader.jsx'
import CreateGroupFlow from '../messaging/CreateGroupFlow.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats, subscribeToSentPendingChats, subscribeToMessageRequests } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

/**
 * Phase 1 foundation change: the list-rendering JSX that used to live
 * directly in this file's <main> is now ChatListPanel.jsx — a pure
 * presentational extraction, not a rewrite. Every data-fetching effect
 * below (subscribeToUserChats, subscribeToSentPendingChats,
 * subscribeToMessageRequests, profile enrichment) is completely
 * unchanged from before this pass, byte-for-byte the same logic, just
 * still living here rather than being duplicated into the panel
 * component. This is what lets ChatPage.jsx (a separate route) also
 * render the identical panel in a later pass without copying the
 * list-item markup a second time.
 *
 * Desktop (lg+): sidebar + this list panel (widened) + a third column
 * showing "select a conversation" — since no chat is active at this
 * route specifically. Mobile is the exact same single-panel view as
 * before Phase 1, unchanged.
 */
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
  const [profile, setProfile] = useState(null)
  const fetchedUidsRef = useRef(new Set())

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    getUserProfile(uid).then(setProfile).catch(() => {})

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
        const p = profiles[chat.otherUid]
        const nameMatch = (p?.displayName || '').toLowerCase().includes(normalizedSearch)
        const usernameMatch = (p?.username || '').toLowerCase().includes(normalizedSearch)
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
    <div
      className="relative overflow-x-hidden lg:flex lg:h-screen lg:overflow-hidden lg:gap-3"
      style={{ backgroundColor: '#f3f0fb' }}
    >
      <div
        className="ambient-glow-layer ambient-glow-1"
        style={{ background: 'radial-gradient(ellipse 1100px 750px at 8% -8%, rgba(147,112,255,0.32), transparent 55%)' }}
      />
      <div
        className="ambient-glow-layer ambient-glow-2"
        style={{
          background:
            'radial-gradient(ellipse 900px 700px at 100% 15%, rgba(96,165,250,0.24), transparent 55%), radial-gradient(ellipse 700px 600px at 90% 100%, rgba(167,139,250,0.18), transparent 55%)'
        }}
      />
      <div
        className="ambient-glow-layer ambient-glow-3"
        style={{ background: 'radial-gradient(ellipse 850px 650px at 25% 105%, rgba(236,72,153,0.20), transparent 55%)' }}
      />
      <DesktopSidebar profile={profile} />

      <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto lg:w-[380px] lg:flex-shrink-0 lg:my-4 lg:rounded-3xl lg:border lg:border-white/50 lg:shadow-[0_8px_32px_rgba(91,77,255,0.08)] overflow-x-hidden">
        <div className="mx-auto max-w-[480px] lg:max-w-none min-h-screen lg:min-h-0 bg-white/85 backdrop-blur-md lg:bg-white/40 lg:backdrop-blur-2xl lg:rounded-3xl">
          <header className="sticky top-0 z-40 bg-white/55 backdrop-blur-xl border-b border-white/40">
            <div className="h-14 flex items-center gap-2 px-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate('/home')}
                className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-bold tracking-tight text-gray-900 flex-1">Chats</span>

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
      </div>

      {/* Desktop third column — no conversation is active at this
          route, so this is a real, honest placeholder rather than
          leaving a blank white area. Only shown at lg:+. */}
      <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:h-screen">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-200 to-indigo-200 blur-xl opacity-60" />
            <div className="relative w-14 h-14 rounded-full bg-white/50 backdrop-blur-md border border-white/50 shadow-[0_4px_16px_rgba(91,77,255,0.08)] flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-900">Your conversations start here.</p>
          <p className="mt-1 text-sm text-gray-400">Pick a chat from the left to start messaging.</p>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
      <CreateGroupFlow open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
    </div>
  )
}
