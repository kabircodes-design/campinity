import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ChatCard from '../components/ChatCard.jsx'
import EmptyChat from '../components/EmptyChat.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { subscribeToUserChats } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

export default function MessagesPage() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
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
      () => {
        setError('Could not load your messages.')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [])

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
            <span className="text-base font-bold tracking-tight text-gray-900">Messages</span>
          </div>
        </header>

        <main className="pb-24">
          {error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : chats.length === 0 ? (
            <EmptyChat />
          ) : (
            <div>
              {chats.map((chat) => (
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