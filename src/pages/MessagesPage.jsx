import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, MessageCircle, MessageSquarePlus, Radar, Search, Users } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import Avatar from '../components/Avatar.jsx'
import Logo from '../components/Logo.jsx'
import ChatListPanel from '../components/ChatListPanel.jsx'
import CallOverlay from '../components/CallOverlay.jsx'
import Loader from '../auth/components/Loader.jsx'
import CreateGroupFlow from '../messaging/CreateGroupFlow.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats, subscribeToSentPendingChats, subscribeToMessageRequests } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { subscribeToUnreadCount } from '../firebase/notificationService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { useCall } from '../hooks/useCall.js'

/**
 * Redesigned to match the finished Home page's design system (clean
 * white surfaces, blue accent, no glassmorphism) instead of this page's
 * previous purple/lavender glass theme — presentation only. Every
 * existing data subscription (subscribeToUserChats/
 * subscribeToSentPendingChats/subscribeToMessageRequests, profile
 * enrichment) is unchanged, byte-for-byte the same logic as before this
 * pass.
 *
 * No Stories anywhere on this page, by explicit instruction — the slot
 * where a Stories row might otherwise go is Message Requests instead,
 * now a full prominent row (not a small pill) directly under search.
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
  const [profile, setProfile] = useState(null)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const fetchedUidsRef = useRef(new Set())
  const call = useCall()

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

  useEffect(() => {
    const uid = auth.currentUser?.uid
    const unsubscribe = subscribeToUnreadCount(uid, setUnreadNotifCount)
    return () => unsubscribe()
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

  const initials = getInitials(profile?.displayName || '')
  const myColorClass = getAvatarColor(auth.currentUser?.uid || profile?.displayName)

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
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

        <div className="flex flex-col h-screen lg:overflow-hidden overflow-x-hidden min-w-0">
          {/* Global header — same treatment as the finished Home page,
              duplicated rather than extracted so Home's own file is
              never touched. */}
          <header className="sticky top-0 z-40 bg-white border-b border-gray-100 flex-shrink-0">
            <div className="h-14 flex items-center gap-3 px-4 lg:px-6">
              <button
                type="button"
                onClick={() => navigate('/home')}
                aria-label="Campinity — go to Home"
                className="lg:hidden flex items-center flex-shrink-0"
              >
                <Logo className="w-7 h-7" withWordmark />
              </button>

              <button
                type="button"
                onClick={() => navigate('/search')}
                className="group relative hidden lg:flex flex-1 max-w-md mx-auto items-center text-left"
                aria-label="Search Campinity"
              >
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors duration-200 group-hover:text-gray-500" />
                <span className="flex items-center justify-between w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-2.5 py-2 text-sm text-gray-400 transition-all duration-200 group-hover:bg-white group-hover:border-gray-300 group-hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]">
                  Search for people, communities, posts...
                  <kbd className="flex-shrink-0 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                    Ctrl K
                  </kbd>
                </span>
              </button>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  aria-label="Radar"
                  onClick={() => navigate('/radar')}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
                >
                  <Radar className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Messages"
                  onClick={() => navigate('/messages')}
                  className="relative hidden lg:flex w-9 h-9 rounded-full items-center justify-center text-blue-600 bg-blue-50 transition-all duration-200"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() => navigate('/notifications')}
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all duration-200"
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotifCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
                  )}
                </button>
                {profile && (
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    aria-label="Your profile"
                    className="hidden lg:flex items-center ml-1 rounded-full hover:bg-gray-100 p-0.5 transition-all duration-200"
                  >
                    <Avatar initials={initials} colorClass={myColorClass} size="sm" src={getProfileIdentityImage(profile) || undefined} />
                  </button>
                )}
              </div>
            </div>
          </header>

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
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
      <CreateGroupFlow open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
      <CallOverlay call={call} />
    </>
  )
}
