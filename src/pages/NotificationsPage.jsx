import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import NotificationCard from '../components/NotificationCard.jsx'
import EmptyNotifications from '../components/EmptyNotifications.jsx'
import NotificationBadge from '../components/NotificationBadge.jsx'
import NotificationSkeleton from '../components/NotificationSkeleton.jsx'
import { auth } from '../firebase/firebase.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getUserProfile } from '../firebase/profileService.js'
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

/**
 * Groups consecutive 'like' notifications sharing the same postId
 * into one display entry — "Aarav, Priya and 2 others liked your
 * post" instead of 4 separate cards. Pure client-side aggregation of
 * data already fetched, no backend change, no new query. Only 'like'
 * is grouped (the brief's own explicit example, and genuinely the
 * highest-volume repetitive type) — other types (comments, replies)
 * stay individual, since collapsing distinct comments together would
 * lose their actual content rather than just reduce visual noise.
 */
function applySmartGrouping(notifications) {
  const result = []
  let i = 0
  while (i < notifications.length) {
    const current = notifications[i]
    if (current.type !== 'like' || !current.postId) {
      result.push(current)
      i += 1
      continue
    }
    const group = [current]
    let j = i + 1
    while (j < notifications.length && notifications[j].type === 'like' && notifications[j].postId === current.postId) {
      group.push(notifications[j])
      j += 1
    }
    result.push(group.length === 1 ? current : { ...current, groupedActors: group, read: group.every((n) => n.read) })
    i = j
  }
  return result
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getUserProfile(uid).then(setProfile).catch(() => {})
  }, [])

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
            actorAvatar: getProfileIdentityImage(profile) || '',
            actorUsername: profile.username,
            actorVerified: profile.verifiedCampus
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

  const groupedNotifications = useMemo(() => groupNotifications(applySmartGrouping(notifications)), [notifications])

  const markAsRead = (id) => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    // Look up from the GROUPED list (not raw `notifications`) so a
    // grouped entry's groupedActors is visible here — a grouped 'like'
    // notification's displayed id is shared with the first underlying
    // notification, but marking read must cover every notification in
    // that group, not just that first one.
    const flatGrouped = groupedNotifications.flatMap(([, items]) => items)
    const target = flatGrouped.find((notification) => notification.id === id)
    if (!target || target.read) return

    const idsToMark = target.groupedActors ? target.groupedActors.map((n) => n.id) : [id]

    setNotifications((prev) =>
      prev.map((notification) => (idsToMark.includes(notification.id) ? { ...notification, read: true } : notification))
    )
    Promise.all(idsToMark.map((markId) => markNotificationRead(uid, markId))).catch(() => {
      setNotifications((prev) =>
        prev.map((notification) => (idsToMark.includes(notification.id) ? { ...notification, read: false } : notification))
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
      <div className="lg:flex lg:h-screen lg:overflow-hidden bg-gray-50">
        <DesktopSidebar profile={profile} />
        <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto overflow-x-hidden bg-gray-50">
          <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white min-h-screen lg:min-h-0 lg:shadow-sm lg:border-x lg:border-gray-100">
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
              <div className="h-14 flex items-center gap-2 px-3">
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => navigate('/home')}
                  className="lg:hidden w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-base font-bold tracking-tight text-gray-900">Notifications</span>
              </div>
            </header>
            <NotificationSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden bg-gray-50">
      <DesktopSidebar profile={profile} />
      <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white min-h-screen lg:min-h-0 lg:shadow-sm lg:border-x lg:border-gray-100">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/home')}
              className="lg:hidden w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
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
            <>
              {unreadCount === 0 && (
                <div className="mx-4 mt-4 rounded-2xl bg-green-50 border border-green-100 px-4 py-3 flex items-center gap-2.5">
                  <span className="text-base">✨</span>
                  <p className="text-xs font-medium text-green-700">You're all caught up. Nothing important slipped past you.</p>
                </div>
              )}
              {groupedNotifications.map(([label, items]) => (
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
              ))}
            </>
          )}
        </main>
      </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
