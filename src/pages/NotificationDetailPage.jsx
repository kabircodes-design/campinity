import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { auth } from '../firebase/firebase.js'
import { getNotificationById, markNotificationRead } from '../firebase/notificationService.js'
import { getNotificationRoute } from '../utils/notificationText.js'
import ComingSoon from './ComingSoon.jsx'

/**
 * /notifications/:id — a link to one notification (e.g. a shared push
 * link). Loads the REAL notification from the signed-in user's own
 * collection, marks it read, and forwards to the same destination a tap
 * in the Notifications list would open. This route previously rendered
 * hardcoded sample notifications (dummyNotifications.js).
 */
export default function NotificationDetailPage() {
  const { notificationId } = useParams()
  const [state, setState] = useState({ status: 'loading', route: null })

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid
    getNotificationById(uid, notificationId)
      .then((notification) => {
        if (cancelled) return
        if (!notification) {
          setState({ status: 'missing', route: null })
          return
        }
        if (!notification.read) markNotificationRead(uid, notification.id).catch(() => {})
        setState({ status: 'ready', route: getNotificationRoute(notification) || '/notifications' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', route: null })
      })
    return () => {
      cancelled = true
    }
  }, [notificationId])

  if (state.status === 'ready') return <Navigate to={state.route} replace />
  if (state.status === 'missing') {
    return <ComingSoon title="Notification not found" message="This notification was deleted or no longer exists." />
  }
  if (state.status === 'error') {
    return <ComingSoon title="Couldn't open notification" message="Check your connection and try again from your Notifications." />
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-white" aria-busy="true">
      <span className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" aria-label="Loading" />
    </div>
  )
}
