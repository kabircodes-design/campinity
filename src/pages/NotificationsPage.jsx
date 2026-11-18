import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Bell, CheckCheck, ChevronRight, Compass, Settings2, User, Users } from 'lucide-react'
import NotificationCard from '../components/NotificationCard.jsx'
import EmptyNotifications from '../components/EmptyNotifications.jsx'
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
import { resolveIdentity } from '../identity/identity.js'

const PAGE_STEP = 20

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
  const [filter, setFilter] = useState('all') // 'all' | 'unread' — client-side over the same live list
  const [reloadKey, setReloadKey] = useState(0)
  // Pagination: the live listener's window grows by PAGE_STEP per
  // "Load more" — no duplicates or gaps when new notifications arrive,
  // read state stays live for everything shown, and the end of the list
  // is exact (fewer results than the window).
  const [pageLimit, setPageLimit] = useState(PAGE_STEP + 10)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const firstLoadRef = useRef(true)

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

    if (firstLoadRef.current) setLoading(true)
    setError('')
    let sequence = 0
    const unsubscribe = subscribeToNotifications(uid, { pageSize: pageLimit }, (data) => {
      const thisSequence = ++sequence
      const more = data.length >= pageLimit
      // Live-enrich actor info instead of trusting actorName/actorAvatar
      // as written at creation time — a stale write-time snapshot can't
      // reflect a later profile change.
      enrichWithAuthors(
        data,
        (notification) => notification.actorUid,
        (notification, profile) => ({
          ...notification,
          ...(() => {
            const id = resolveIdentity(profile, { name: notification.actorName, username: notification.actorUsername })
            return { actorName: id.name || notification.actorName || 'Someone', actorAvatar: id.hidden ? '' : getProfileIdentityImage(profile) || '', actorUsername: id.username, actorVerified: id.hidden ? false : profile.verifiedCampus }
          })()
        })
      )
        .then((enriched) => {
          if (sequence !== thisSequence) return
          setNotifications(enriched)
          setHasMore(more)
          setLoading(false)
          setLoadingMore(false)
          firstLoadRef.current = false
        })
        .catch((err) => {
          if (sequence !== thisSequence) return
          setError(err?.message || 'Could not load notifications.')
          setLoading(false)
        })
    }, (err) => {
      setError(err?.message || 'Could not load notifications.')
      setLoading(false)
      setLoadingMore(false)
    })

    return () => unsubscribe()
  }, [reloadKey, pageLimit])

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setPageLimit((n) => n + PAGE_STEP)
  }

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

  // Unread filter works on the same live list (and keeps a grouped like
  // entry when any of its underlying notifications is still unread).
  const visibleGroups =
    filter === 'unread'
      ? groupedNotifications.map(([label, items]) => [label, items.filter((n) => !n.read)]).filter(([, items]) => items.length > 0)
      : groupedNotifications

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread', count: unreadCount }
  ]

  return (
    <div className="min-h-screen lg:min-h-0 lg:h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-white lg:bg-gray-50">
      <div className="lg:flex lg:items-start lg:gap-5 lg:px-6 lg:py-4 lg:max-w-[1180px] lg:mx-auto">
        <div className="mx-auto max-w-[560px] lg:mx-0 lg:max-w-[680px] lg:flex-1 lg:min-w-0 bg-white lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <header className="px-4 lg:px-6 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-1 min-w-0">
                <button
                  type="button"
                  aria-label="Back"
                  onClick={() => navigate(-1)}
                  className="lg:hidden w-10 h-10 -ml-2 mt-[-2px] flex-shrink-0 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all duration-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Notifications</h1>
                  <p className="mt-0.5 text-[13px] text-gray-500">
                    {loading ? 'Checking for updates…' : unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}` : 'You’re all caught up'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Notification settings"
                onClick={() => navigate('/settings/notifications')}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all duration-200"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 pb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2" role="tablist" aria-label="Filter notifications">
                {filters.map((f) => {
                  const isActive = filter === f.key
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setFilter(f.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                      {f.count > 0 && (
                        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${isActive ? 'bg-white/25 text-white' : 'bg-red-500 text-white'}`}>
                          {f.count > 99 ? '99+' : f.count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-blue-600 hover:bg-blue-50 active:scale-95 transition-all duration-200"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
            </div>
          </header>

          <main className="pb-24 lg:pb-4 border-t border-gray-100">
            {loading ? (
              <NotificationSkeleton />
            ) : error ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p className="mt-3 text-[15px] font-semibold text-gray-900">Couldn't load notifications</p>
                <p className="mt-1 text-sm text-gray-500">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => {
                    firstLoadRef.current = true
                    setReloadKey((k) => k + 1)
                  }}
                  className="mt-4 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-200"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <EmptyNotifications />
            ) : visibleGroups.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <p className="mt-3 text-[15px] font-semibold text-gray-900">No unread notifications</p>
                <p className="mt-1 text-sm text-gray-500">You’ve seen everything new.</p>
                <button type="button" onClick={() => setFilter('all')} className="mt-4 text-sm font-semibold text-blue-600">
                  Show all
                </button>
              </div>
            ) : (
              <>
                {visibleGroups.map(([label, items]) => (
                  <section key={label} aria-label={label}>
                    <h2 className="px-4 lg:px-6 pt-4 pb-1.5 text-[13px] font-bold text-gray-900">{label}</h2>
                    {items.map((notification) => (
                      <NotificationCard key={notification.id} notification={notification} onRead={markAsRead} onDelete={handleDeleteNotification} />
                    ))}
                  </section>
                ))}
                <div className="px-4 py-5 flex justify-center">
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 disabled:opacity-60 transition-all duration-200"
                    >
                      {loadingMore && <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />}
                      {loadingMore ? 'Loading…' : 'Load older notifications'}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400">You've reached the end</p>
                  )}
                </div>
              </>
            )}
          </main>
        </div>

        <aside className="hidden lg:flex lg:flex-col w-[300px] flex-shrink-0 gap-4 py-4">
          <section className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Bell className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-bold text-gray-900">Summary</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
                <p className="text-xs text-gray-400">Unread</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
                <p className="text-xs text-gray-400">Total</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm font-bold text-gray-900 mb-3">Quick Actions</p>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <button
                  key={action.to}
                  type="button"
                  onClick={() => navigate(action.to)}
                  className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 -mx-2 hover:bg-gray-50 transition-all duration-200 text-left"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-4 h-4" />
                  </span>
                  <span className="text-[13px] font-semibold text-gray-900">{action.label}</span>
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => navigate('/settings/notifications')}
            className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-left hover:bg-gray-50 transition-all duration-200"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Settings2 className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Notification settings</p>
              <p className="text-xs text-gray-400 mt-0.5">Choose what you get notified about</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        </aside>
      </div>
    </div>
  )
}
