import { useEffect, useState } from 'react'
import { Megaphone, Pin, PinOff, Send, Trash2 } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'
import { listRecentAnnouncementsForAdmin } from '../../firebase/announcementService.js'

const PRIORITIES = [
  { key: 'normal', label: 'Normal' },
  { key: 'important', label: 'Important' },
  { key: 'urgent', label: 'Urgent' }
]

/**
 * A real admin broadcast — adminSendNotification writes into the exact
 * same notifications/{notificationId} schema and 'announcement' type
 * createCommunityAnnouncementNotifications already established
 * (notificationService.js), fanned out via the same batched-write
 * pattern. Recipients actually see it on their real Notifications page
 * — this is not a UI that only updates local React state.
 *
 * Phase 2 extension: a broadcast (not a single targetUsername, which
 * stays a private one-off notification) now also persists as a real
 * announcements/{id} document — the "Campus Notice" management list
 * below reads and manages those same documents, not a parallel one.
 */
export default function AdminNotificationsPage() {
  const { sessionToken } = useAdminSession()
  const [message, setMessage] = useState('')
  const [title, setTitle] = useState('')
  const [targetUsername, setTargetUsername] = useState('')
  const [collegeId, setCollegeId] = useState('')
  const [priority, setPriority] = useState('normal')
  const [pinned, setPinned] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [toast, setToast] = useState(null)

  const [announcements, setAnnouncements] = useState([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setAnnouncementsLoading(true)
    listRecentAnnouncementsForAdmin()
      .then((data) => {
        if (!cancelled) setAnnouncements(data)
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([])
      })
      .finally(() => {
        if (!cancelled) setAnnouncementsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const trimmedMessage = message.trim()
  const canSend = trimmedMessage.length > 0 && trimmedMessage.length <= 280 && !sending

  const handleConfirmedSend = async () => {
    setConfirmSend(false)
    setSending(true)
    try {
      const data = await callAdmin('adminSendNotification', {
        sessionToken,
        message: trimmedMessage,
        title: title.trim() || undefined,
        targetUsername: targetUsername.trim() || undefined,
        collegeId: targetUsername.trim() ? undefined : collegeId.trim() || undefined,
        priority: targetUsername.trim() ? undefined : priority,
        pinned: targetUsername.trim() ? undefined : pinned
      })
      setToast({ tone: 'success', message: `Sent to ${data?.recipientCount ?? 0} student${data?.recipientCount === 1 ? '' : 's'}.` })
      setMessage('')
      setTitle('')
      setTargetUsername('')
      setCollegeId('')
      setPinned(false)
      if (data?.announcementId) setReloadKey((k) => k + 1)
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not send this notification.' })
    } finally {
      setSending(false)
    }
  }

  const handleTogglePin = async (announcement) => {
    setBusyId(announcement.id)
    try {
      await callAdmin('adminSetAnnouncementPinned', { sessionToken, announcementId: announcement.id, pinned: !announcement.pinned })
      setAnnouncements((prev) => prev.map((a) => (a.id === announcement.id ? { ...a, pinned: !a.pinned } : a)))
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this announcement.' })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (announcement) => {
    setBusyId(announcement.id)
    try {
      await callAdmin('adminDeleteAnnouncement', { sessionToken, announcementId: announcement.id })
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id))
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not remove this announcement.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Notifications &amp; Announcements</h1>
      <p className="mt-1 text-sm text-gray-400">
        Send a real platform notification to one student, everyone on Campinity, or everyone at one college — and
        optionally post it as a standing Campus Notice.
      </p>

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

        {!targetUsername.trim() && (
          <>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-4">
              College ID (optional — leave blank for every college)
            </label>
            <input
              type="text"
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
              placeholder="collegeId"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
            />

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-4">
              Title (optional — shown on the Campus Notice card)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Exam schedule update"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
            />
          </>
        )}

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

        {!targetUsername.trim() && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(p.key)}
                className={`rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 ${
                  priority === p.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPinned((v) => !v)}
              className={`flex items-center gap-1 rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 ${
                pinned ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Pin className="w-3 h-3" fill={pinned ? 'currentColor' : 'none'} /> Pin
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setConfirmSend(true)}
          disabled={!canSend}
          className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
        >
          <Send className="w-4 h-4" />
          {sending
            ? 'Sending…'
            : targetUsername.trim()
              ? `Send to @${targetUsername.trim()}`
              : collegeId.trim()
                ? `Send to college "${collegeId.trim()}"`
                : 'Send to everyone'}
        </button>
      </div>

      {confirmSend && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button type="button" aria-label="Cancel" onClick={() => setConfirmSend(false)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[360px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {targetUsername.trim()
                ? `Send this to @${targetUsername.trim()}?`
                : collegeId.trim()
                  ? `Send this to every student at college "${collegeId.trim()}"?`
                  : 'Send this to every student on Campinity?'}
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

      <div className="mt-8">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <Megaphone className="w-4 h-4 text-blue-600" /> Campus Notices
        </h2>
        <p className="mt-1 text-xs text-gray-400">Persisted announcements students see on Home, not just a one-time notification.</p>

        <div className="mt-3 max-w-lg space-y-2">
          {announcementsLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
          ) : announcements.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No campus notices yet.</div>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{a.priority || 'normal'}</span>
                    {a.pinned && <Pin className="w-3 h-3 text-amber-500" fill="currentColor" />}
                    {a.collegeId ? (
                      <span className="text-[10px] text-gray-400">College: {a.collegeId}</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">All colleges</span>
                    )}
                  </div>
                  {a.title && <p className="mt-1 text-sm font-semibold text-gray-900">{a.title}</p>}
                  <p className="mt-0.5 text-xs text-gray-600">{a.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePin(a)}
                  disabled={busyId === a.id}
                  aria-label={a.pinned ? 'Unpin' : 'Pin'}
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-40"
                >
                  {a.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a)}
                  disabled={busyId === a.id}
                  aria-label="Remove"
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
