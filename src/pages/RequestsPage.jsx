import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials, formatTimeAgo } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { subscribeToMessageRequests, acceptMessageRequest, deleteMessageRequest } from '../firebase/chatService.js'

/**
 * New — the actual missing piece confirmed by direct audit last pass:
 * subscribeToMessageRequests existed in chatService.js but was never
 * called from anywhere in the UI. This is that UI.
 */
export default function RequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusyId, setActionBusyId] = useState(null)
  const fetchedUidsRef = useRef(new Set())

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    const unsubscribe = subscribeToMessageRequests(uid, (data) => {
      const safeRequests = Array.isArray(data) ? data.filter(Boolean) : []
      setRequests(safeRequests)
      setLoading(false)

      safeRequests.forEach((req) => {
        if (!req?.otherUid || fetchedUidsRef.current.has(req.otherUid)) return
        fetchedUidsRef.current.add(req.otherUid)
        getUserProfile(req.otherUid)
          .then((profile) => {
            if (profile) setProfiles((prev) => ({ ...prev, [req.otherUid]: profile }))
          })
          .catch(() => {})
      })
    })

    return unsubscribe
  }, [])

  const handleAccept = async (chatId) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setActionBusyId(chatId)
    try {
      await acceptMessageRequest(chatId, uid)
      navigate(`/messages/${chatId}`)
    } catch (err) {
      console.error('Could not accept this request:', err)
      setActionBusyId(null)
    }
  }

  const handleDelete = async (chatId) => {
    setActionBusyId(chatId)
    try {
      await deleteMessageRequest(chatId)
    } catch (err) {
      console.error('Could not delete this request:', err)
    } finally {
      setActionBusyId(null)
    }
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
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">
              Requests {requests.length > 0 && `(${requests.length})`}
            </span>
          </div>
        </header>

        <main className="pb-24">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader size="lg" tone="dark" />
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-semibold text-gray-900">No message requests</p>
              <p className="mt-1 text-sm text-gray-400">Requests from people you haven't chatted with show up here.</p>
            </div>
          ) : (
            <div>
              {requests.map((req) => {
                const profile = profiles[req.otherUid]
                const displayName = profile?.displayName || 'Student'
                const isBusy = actionBusyId === req.id

                return (
                  <div key={req.id} className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-50">
                    <button type="button" onClick={() => navigate(`/student/${profile?.username || ''}`)} className="flex-shrink-0">
                      <Avatar
                        initials={getInitials(displayName)}
                        colorClass={getAvatarColor(req.otherUid)}
                        size="md"
                        src={profile?.avatar || undefined}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{formatTimeAgo(req.lastMessageAt)}</span>
                      </div>
                      {profile?.username && <p className="text-[11px] text-gray-400">@{profile.username}</p>}
                      <p className="mt-1 text-[13px] text-gray-600 truncate">{req.lastMessage || 'Sent you a message'}</p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAccept(req.id)}
                          disabled={isBusy}
                          className="rounded-full bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
                        >
                          {isBusy ? '...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(req.id)}
                          disabled={isBusy}
                          className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-4 py-1.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
