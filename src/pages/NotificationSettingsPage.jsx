import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NOTIFICATION_PREFERENCE_DEFAULTS
} from '../firebase/notificationService.js'

const OPTIONS = [
  { key: 'likes', label: 'Likes', description: 'When someone likes your post or comment' },
  { key: 'comments', label: 'Comments', description: 'Comments, replies, and mentions' },
  { key: 'follows', label: 'Follows', description: 'When someone starts following you' },
  { key: 'messages', label: 'Message requests', description: 'New requests and acceptances' },
  { key: 'communities', label: 'Communities', description: 'Announcements from your communities' },
  { key: 'calls', label: 'Calls', description: 'Incoming voice and video calls' }
]

/**
 * Real preferences, not a cosmetic toggle — backed by
 * notificationService.js's centralized createNotification() check
 * (see that file's comment), so turning one of these off actually
 * stops that category of notification from being written at all, not
 * just hidden in the UI. App.jsx's /settings/notifications route
 * previously rendered <ComingSoon>; this is what replaces it.
 */
export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [prefs, setPrefs] = useState(NOTIFICATION_PREFERENCE_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!currentUid) {
      setError('Not signed in.')
      setLoading(false)
      return
    }
    getNotificationPreferences(currentUid)
      .then(setPrefs)
      .catch((err) => setError(err?.message || 'Could not load your notification settings.'))
      .finally(() => setLoading(false))
  }, [currentUid])

  const handleToggle = async (key) => {
    if (!currentUid || busyKey) return
    setBusyKey(key)
    const next = { ...prefs, [key]: !prefs[key] }
    const previous = prefs
    setPrefs(next)
    try {
      await updateNotificationPreferences(currentUid, next)
      setToast('Notification preferences saved')
      window.setTimeout(() => setToast(''), 1800)
    } catch (err) {
      setPrefs(previous)
      setToast(err?.message || "Couldn't update this setting.")
      window.setTimeout(() => setToast(''), 2200)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="h-full w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Notifications</span>
          </div>
        </header>

        <main className="px-4 py-4">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : error ? (
            <p className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">{error}</p>
          ) : (
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 dark:border-white/10 dark:divide-white/10 overflow-hidden">
              {OPTIONS.map((option) => (
                <div key={option.key} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{option.label}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[option.key] !== false}
                    aria-label={option.label}
                    disabled={busyKey === option.key}
                    onClick={() => handleToggle(option.key)}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-300 disabled:opacity-60 ${
                      prefs[option.key] !== false ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/15'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                        prefs[option.key] !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] rounded-full bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
