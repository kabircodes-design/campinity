import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ChatCard from '../components/ChatCard.jsx'
import EmptyChat from '../components/EmptyChat.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats, subscribeToSentPendingChats, subscribeToMessageRequests } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

export default function MessagesPage() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [sentPendingChats, setSentPendingChats] = useState([])
  const [incomingRequestCount, setIncomingRequestCount] = useState(0)
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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
          </div>
        </header>

        <main className="pb-24">
          {error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : allChats.length === 0 ? (
            <EmptyChat />
          ) : (
            <div>
              {allChats.map((chat) => (
                <ChatCard key={chat.id} chat={chat} profile={profiles[chat.otherUid]} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
