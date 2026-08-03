import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import NotificationCard from '../components/NotificationCard.jsx'
import EmptyNotifications from '../components/EmptyNotifications.jsx'
import NotificationBadge from '../components/NotificationBadge.jsx'
import NotificationSkeleton from '../components/NotificationSkeleton.jsx'
import { auth } from '../firebase/firebase.js'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../firebase/notificationService.js'
import { enrichWithAuthors } from '../hooks/useAuthorEnrichment.js'

/**
 * Today/Yesterday/Earlier grouping — computed with useMemo so this
 * only re-runs when `notifications` actually changes (a new fetch, a
 * delete), not on every re-render (e.g. the mark-all-read button's own
 * hover state) — the "no unnecessary rerenders" requirement.
 */
function groupNotifications(notifications) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000

  const groups = { Today: [], Yesterday: [], Earlier: [] }

  notifications.forEach((notification) => {
    const ms = notification.createdAt?.toMillis ? notification.createdAt.toMillis() : 0
    if (ms >= todayStart) groups.Today.push(notification)
    else if (ms >= yesterdayStart) groups.Yesterday.push(notification)
    else groups.Earlier.push(notification)
  })

  return Object.entries(groups).filter(([, items]) => items.length > 0)
}

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
        // getNotifications returns { notifications, nextCursor } — same
        // pagination-object convention communityService.js already uses
        // everywhere else in this project (getMembers, getCommunityFeedPosts).
        // Destructuring the array out here, matching how
        // CommunityDetailPage.jsx already handles that same shape.
        const { notifications: data } = await getNotifications(uid)

        // Live-enrich actor info instead of trusting actorName/actorAvatar
        // as written at creation time — same root cause and same fix as
        // the Following feed: a stale write-time snapshot can't reflect a
        // later profile change. notificationService.js's create functions
        // still WRITE actorName/actorAvatar (harmless, unused after this —
        // left alone rather than touching a working write path that
        // isn't this bug's cause).
        const enriched = await enrichWithAuthors(
          data,
          (notification) => notification.actorUid,
          (notification, profile) => ({
            ...notification,
            actorName: profile.displayName,
            actorAvatar: profile.avatar,
            actorUsername: profile.username,
            actorVerified: profile.verified
          })
        )

        if (!cancelled) setNotifications(enriched)
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

  const groupedNotifications = useMemo(() => groupNotifications(notifications), [notifications])

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
              <span className="text-base font-bold tracking-tight text-gray-900">Notifications</span>
            </div>
          </header>
          <NotificationSkeleton />
        </div>
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
            groupedNotifications.map(([label, items]) => (
              <section key={label}>
                <p className="px-4 pt-4 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {label}
                </p>
                {items.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onDelete={handleDeleteNotification}
                  />
                ))}
              </section>
            ))
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
