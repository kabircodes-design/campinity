import { useEffect, useRef, useState } from 'react'
import { AtSign, BellRing, Heart, Megaphone, MessageCircle, Phone, UserPlus, Users } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import SettingsPageShell, { Notice } from '../components/settings/SettingsPageShell.jsx'
import { IconTile, RowGroup, Switch, Toast } from '../components/ui/Premium.jsx'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NOTIFICATION_PREFERENCE_DEFAULTS
} from '../firebase/notificationService.js'

const GROUPS = [
  {
    label: 'Social',
    options: [
      { key: 'likes', label: 'Likes', description: 'When someone likes your post or comment', icon: Heart, tone: 'rose' },
      { key: 'comments', label: 'Comments', description: 'Comments, replies and mentions', icon: AtSign, tone: 'blue' },
      { key: 'follows', label: 'Follows', description: 'When someone starts following you', icon: UserPlus, tone: 'violet' }
    ]
  },
  {
    label: 'Messages & calls',
    options: [
      { key: 'messages', label: 'Message requests', description: 'New requests and acceptances', icon: MessageCircle, tone: 'emerald' },
      { key: 'calls', label: 'Calls', description: 'Incoming voice and video calls', icon: Phone, tone: 'emerald' }
    ]
  },
  {
    label: 'Campus',
    options: [
      { key: 'communities', label: 'Communities', description: 'Activity in your communities', icon: Users, tone: 'amber' },
      { key: 'announcements', label: 'Campinity announcements', description: 'Official messages from the Campinity team', icon: Megaphone, tone: 'blue' }
    ]
  }
]

/**
 * Real preferences — notificationService's createNotification() checks them,
 * so turning one off stops that category being written, not just hidden.
 */
export default function NotificationSettingsPage() {
  const currentUid = auth.currentUser?.uid
  const [prefs, setPrefs] = useState(NOTIFICATION_PREFERENCE_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [toast, setToast] = useState({ message: '', tone: 'neutral' })
  const toastTimer = useRef(null)

  const flash = (message, tone = 'neutral') => {
    setToast({ message, tone })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast({ message: '', tone: 'neutral' }), tone === 'error' ? 2600 : 1600)
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

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
    const previous = prefs
    const next = { ...prefs, [key]: !(prefs[key] !== false) }
    setPrefs(next)
    try {
      await updateNotificationPreferences(currentUid, next)
      flash('Saved')
    } catch (err) {
      setPrefs(previous)
      flash(err?.message || "Couldn't update this setting.", 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const all = GROUPS.flatMap((g) => g.options)
  const enabledCount = all.filter((o) => prefs[o.key] !== false).length

  return (
    <SettingsPageShell title="Notifications" description="Choose what Campinity notifies you about. Changes save instantly.">
      {loading ? (
        <div className="py-16 flex justify-center" role="status" aria-label="Loading notification settings">
          <Loader size="md" tone="dark" />
        </div>
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <div className="px-4 pt-2 space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 px-4 py-3">
            <IconTile icon={BellRing} />
            <p className="text-[13px] text-gray-700 dark:text-gray-200">
              <span className="font-semibold tabular-nums">{enabledCount}</span> of {all.length} notification types are on
            </p>
          </div>
          {GROUPS.map((group) => (
            <RowGroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <div key={option.key} className="flex items-center gap-3 pl-4 pr-2 py-2 min-h-[64px]">
                  <IconTile icon={option.icon} tone={option.tone} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14.5px] font-semibold text-gray-900 dark:text-gray-50">{option.label}</p>
                    <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">{option.description}</p>
                  </div>
                  <Switch checked={prefs[option.key] !== false} label={option.label} disabled={busyKey === option.key} onChange={() => handleToggle(option.key)} />
                </div>
              ))}
            </RowGroup>
          ))}
        </div>
      )}
      <Toast message={toast.message} tone={toast.tone} />
    </SettingsPageShell>
  )
}
