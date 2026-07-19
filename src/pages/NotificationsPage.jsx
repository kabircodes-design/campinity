import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import NotificationCard from '../components/NotificationCard.jsx'
import EmptyNotifications from '../components/EmptyNotifications.jsx'
import NotificationBadge from '../components/NotificationBadge.jsx'
import { dummyNotifications } from '../data/dummyNotifications.js'

const groupLabels = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' }
const groupOrder = ['today', 'yesterday', 'earlier']

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState(dummyNotifications)

  const unreadCount = notifications.filter((notification) => !notification.read).length

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }

  const groups = groupOrder
    .map((key) => ({
      key,
      label: groupLabels[key],
      items: notifications.filter((notification) => notification.group === key)
    }))
    .filter((group) => group.items.length > 0)

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
          {groups.length === 0 ? (
            <EmptyNotifications />
          ) : (
            groups.map((group) => (
              <section key={group.key}>
                <p className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {group.label}
                </p>
                <div>
                  {group.items.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}