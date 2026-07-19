import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import NotificationIcon from '../components/NotificationIcon.jsx'
import { dummyNotifications } from '../data/dummyNotifications.js'

export default function NotificationDetailPage() {
  const { notificationId } = useParams()
  const navigate = useNavigate()

  const notification = dummyNotifications.find((item) => item.id === notificationId)

  if (!notification) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">Notification not found</p>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back to Notifications
            </button>
          </div>
        </div>
        <BottomNav />
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
              onClick={() => navigate('/notifications')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Notification</span>
          </div>
        </header>

        <main className="px-6 py-10 text-center">
          <div className="flex justify-center">
            <NotificationIcon type={notification.type} large />
          </div>
          <p className="mt-4 text-[15px] text-gray-800 leading-relaxed">{notification.text}</p>
          <p className="mt-2 text-xs text-gray-400">{notification.time}</p>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}