import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import NotificationCard from '../components/NotificationCard.jsx'
import EmptyNotifications from '../components/EmptyNotifications.jsx'
import NotificationBadge from '../components/NotificationBadge.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../firebase/notificationService.js'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    const load = async () => {
      if (!uid) {
        if (!cancelled) {
          setError('Not signed in.')
          setLoading(false)
        }
        return
      }
      try {
        const data = await getNotifications(uid)
        if (!cancelled) setNotifications(data)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load notifications.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const unreadCount = notifications.filter((notification) => !notification.read).length

  const markAsRead = (id) => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    const target = notifications.find((notification) => notification.id === id)
    if (!target || target.read) return

    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    )
    markNotificationRead(uid, id).catch(() => {
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, read: false } : notification))
      )
    })
  }

  const markAllAsRead = () => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    const previous = notifications
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
    markAllNotificationsRead(uid).catch(() => setNotifications(previous))
  }

  const handleDeleteNotification = (id) => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    const previous = notifications
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
    deleteNotification(uid, id).catch(() => setNotifications(previous))
  }

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
              className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <span className="text-base font-bold tracking-tight text-gray-900">Notifications</span>
              <NotificationBadge count={unreadCount} />
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex-shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-all duration-300"
              >
                Mark all read
              </button>
            )}
          </div>
        </header>

        <main className="pb-24">
          {error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <EmptyNotifications />
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onDelete={handleDeleteNotification}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}