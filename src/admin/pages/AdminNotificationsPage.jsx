import { useState } from 'react'
import { Send } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

/**
 * A real admin broadcast — adminSendNotification writes into the exact
 * same notifications/{notificationId} schema and 'announcement' type
 * createCommunityAnnouncementNotifications already established
 * (notificationService.js), fanned out via the same batched-write
 * pattern. Recipients actually see it on their real Notifications page
 * — this is not a UI that only updates local React state.
 */
export default function AdminNotificationsPage() {
  const { sessionToken } = useAdminSession()
  const [message, setMessage] = useState('')
  const [targetUsername, setTargetUsername] = useState('')
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [toast, setToast] = useState(null)

  const trimmedMessage = message.trim()
  const canSend = trimmedMessage.length > 0 && trimmedMessage.length <= 280 && !sending

  const handleConfirmedSend = async () => {
    setConfirmSend(false)
    setSending(true)
    try {
      const data = await callAdmin('adminSendNotification', {
        sessionToken,
        message: trimmedMessage,
        targetUsername: targetUsername.trim() || undefined
      })
      setToast({ tone: 'success', message: `Sent to ${data?.recipientCount ?? 0} student${data?.recipientCount === 1 ? '' : 's'}.` })
      setMessage('')
      setTargetUsername('')
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not send this notification.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
      <p className="mt-1 text-sm text-gray-400">Send a real platform notification to one student or everyone on Campinity.</p>

      <div className="mt-5 rounded-xl border border-gray-100 bg-white p-4 max-w-lg">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Send to (optional — leave blank to reach everyone)
        </label>
        <input
          type="text"
          value={targetUsername}
          onChange={(e) => setTargetUsername(e.target.value)}
          placeholder="username"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
        />

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-4">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={280}
          placeholder="What's the announcement?"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 resize-none"
        />
        <p className="mt-1 text-right text-[11px] text-gray-300">{trimmedMessage.length}/280</p>

        <button
          type="button"
          onClick={() => setConfirmSend(true)}
          disabled={!canSend}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
        >
          <Send className="w-4 h-4" /> {sending ? 'Sending…' : targetUsername.trim() ? `Send to @${targetUsername.trim()}` : 'Send to everyone'}
        </button>
      </div>

      {confirmSend && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button type="button" aria-label="Cancel" onClick={() => setConfirmSend(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[360px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {targetUsername.trim() ? `Send this to @${targetUsername.trim()}?` : 'Send this to every student on Campinity?'}
            </p>
            <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-700">{trimmedMessage}</p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setConfirmSend(false)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmedSend} className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2">
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
