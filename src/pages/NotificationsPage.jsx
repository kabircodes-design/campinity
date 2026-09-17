import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, ChevronRight, Compass, Settings2, User, Users } from 'lucide-react'
import NotificationCard from '../components/NotificationCard.jsx'
import EmptyNotifications from '../components/EmptyNotifications.jsx'
import NotificationBadge from '../components/NotificationBadge.jsx'
import NotificationSkeleton from '../components/NotificationSkeleton.jsx'
import { auth } from '../firebase/firebase.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications
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

/**
 * Visual redesign pass — same root cause as ProfilePage.jsx/SearchPage.jsx
 * had before their own redesigns: the #f3f0fb page background, three
 * ambient-glow-layer blobs, and bg-white/40 backdrop-blur-2xl container
 * were the same older glass-heavy template, not unique to this page.
 * Replaced with the same plain white/gray-50 + subtle-border + soft-
 * shadow language every other redesigned page now uses. All real
 * functionality below — Firestore load, live author enrichment,
 * Today/Yesterday/Earlier grouping, smart like-grouping, optimistic
 * mark-read/mark-all-read/delete with rollback on failure — is
 * completely untouched, same functions, same logic.
 *
 * New: a right rail (desktop only, and deliberately light per the
 * explicit "don't overdesign, content-first" instruction) — a real
 * unread-count summary (no new data, same unreadCount already
 * computed below), Quick Actions to real existing routes, and a real
 * link to Settings > Notifications (built in an earlier pass — the
 * actual notification-preferences feature this page's own header
 * button now points to, not an invented one).
 */
export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Real-time (Part 5) — subscribeToNotifications already existed in
  // notificationService.js (its own comment even names this exact page
  // as the intended caller) but was never actually wired in; this page
  // was doing a one-shot getNotifications() fetch instead, so a
  // notification created while this page was already open (someone
  // follows you, likes a post, etc.) never appeared without a manual
  // reload. A sequence guard (same pattern postFeedShared.js's
  // subscribeToEnrichedPostsQuery already uses) drops a stale
  // enrichment result if a newer snapshot arrives while it's still in
  // flight, so live updates can never render out of order.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    let sequence = 0
    const unsubscribe = subscribeToNotifications(uid, {}, (data) => {
      const thisSequence = ++sequence
      // Live-enrich actor info instead of trusting actorName/actorAvatar
      // as written at creation time — a stale write-time snapshot can't
      // reflect a later profile change.
      enrichWithAuthors(
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
        .then((enriched) => {
          if (sequence !== thisSequence) return
          setNotifications(enriched)
          setLoading(false)
        })
        .catch((err) => {
          if (sequence !== thisSequence) return
          setError(err?.message || 'Could not load notifications.')
          setLoading(false)
        })
    })

    return () => unsubscribe()
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

  const quickActions = [
    { label: 'View Profile', to: '/profile', icon: User },
    { label: 'Explore Communities', to: '/communities', icon: Users },
    { label: 'Explore Campinity', to: '/search', icon: Compass }
  ]

  return (
    <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        <div className="lg:flex lg:items-start lg:gap-5 lg:px-6 lg:py-4 lg:max-w-[1180px] lg:mx-auto">
          <div className="mx-auto max-w-[480px] lg:mx-0 lg:max-w-[680px] lg:flex-1 lg:min-w-0 bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
            <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
              <div className="h-14 flex items-center gap-2 px-3 lg:px-6">
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Notifications</span>
                  <NotificationBadge count={unreadCount} />
                </div>
                <button
                  type="button"
                  aria-label="Notification settings"
                  onClick={() => navigate('/settings/notifications')}
                  className="hidden lg:flex flex-shrink-0 w-9 h-9 rounded-full items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
                >
                  <Settings2 className="w-[18px] h-[18px]" />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-100 bg-blue-50 rounded-full px-3.5 py-1.5 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-500/20 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 transition-all duration-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <p className="hidden lg:block px-6 pb-3 text-xs text-gray-400 dark:text-gray-500">Stay up to date with what's happening around your campus.</p>
            </header>

            <main className="pb-24">
              {loading ? (
                <NotificationSkeleton />
              ) : error ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Couldn't load notifications</p>
                  <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{error}</p>
                </div>
              ) : notifications.length === 0 ? (
                <EmptyNotifications />
              ) : (
                <>
                  {unreadCount === 0 && (
                    <div className="mx-4 lg:mx-6 mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-2.5 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">You're all caught up. Nothing important slipped past you.</p>
                    </div>
                  )}
                  {groupedNotifications.map(([label, items]) => (
                    <section key={label}>
                      <p className="px-4 lg:px-6 pt-4 pb-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
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

          <aside className="hidden lg:flex lg:flex-col w-[300px] flex-shrink-0 gap-4 py-4">
            <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Bell className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Summary</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{unreadCount}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Unread</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{notifications.length}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Total</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-50 mb-3">Quick Actions</p>
              <div className="space-y-1">
                {quickActions.map((action) => (
                  <button
                    key={action.to}
                    type="button"
                    onClick={() => navigate(action.to)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 -mx-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200 text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                      <action.icon className="w-4 h-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">{action.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={() => navigate('/settings/notifications')}
              className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-left hover:bg-gray-50 dark:border-white/10 dark:bg-[#11131a] dark:hover:bg-white/5 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <Settings2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Notification settings</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Choose what you get notified about</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            </button>
          </aside>
        </div>
    </div>
  )
}
