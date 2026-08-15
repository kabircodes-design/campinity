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
      <div className="relative overflow-x-hidden min-h-screen w-full max-w-[100vw]" style={{ backgroundColor: '#f3f0fb' }}>
        <div
          className="ambient-glow-layer ambient-glow-1"
          style={{ background: 'radial-gradient(ellipse 1100px 750px at 8% -8%, rgba(147,112,255,0.32), transparent 55%)' }}
        />
        <div
          className="ambient-glow-layer ambient-glow-2"
          style={{
            background:
              'radial-gradient(ellipse 900px 700px at 100% 15%, rgba(96,165,250,0.24), transparent 55%), radial-gradient(ellipse 700px 600px at 90% 100%, rgba(167,139,250,0.18), transparent 55%)'
          }}
        />
        <div
          className="ambient-glow-layer ambient-glow-3"
          style={{ background: 'radial-gradient(ellipse 850px 650px at 25% 105%, rgba(236,72,153,0.20), transparent 55%)' }}
        />
        <div className="relative mx-auto max-w-[480px] lg:max-w-[520px] bg-white/45 backdrop-blur-2xl lg:my-4 lg:rounded-3xl lg:border lg:border-white/50 lg:shadow-[0_8px_32px_rgba(91,77,255,0.08)] min-h-screen lg:min-h-0 flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">Notification not found</p>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="mt-4 rounded-full bg-blue-600/90 backdrop-blur-sm text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700/90 transition-all duration-300"
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
    <div className="relative overflow-x-hidden min-h-screen w-full max-w-[100vw]" style={{ backgroundColor: '#f3f0fb' }}>
      <div
        className="ambient-glow-layer ambient-glow-1"
        style={{ background: 'radial-gradient(ellipse 1100px 750px at 8% -8%, rgba(147,112,255,0.32), transparent 55%)' }}
      />
      <div
        className="ambient-glow-layer ambient-glow-2"
        style={{
          background:
            'radial-gradient(ellipse 900px 700px at 100% 15%, rgba(96,165,250,0.24), transparent 55%), radial-gradient(ellipse 700px 600px at 90% 100%, rgba(167,139,250,0.18), transparent 55%)'
        }}
      />
      <div
        className="ambient-glow-layer ambient-glow-3"
        style={{ background: 'radial-gradient(ellipse 850px 650px at 25% 105%, rgba(236,72,153,0.20), transparent 55%)' }}
      />
      <div className="relative mx-auto max-w-[480px] lg:max-w-[520px] bg-white/45 backdrop-blur-2xl lg:my-4 lg:rounded-3xl lg:border lg:border-white/50 lg:shadow-[0_8px_32px_rgba(91,77,255,0.08)] min-h-screen lg:min-h-0">
        <header className="sticky top-0 z-40 bg-white/55 backdrop-blur-xl border-b border-white/40">
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
