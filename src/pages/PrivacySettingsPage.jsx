import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Globe2, Star, UserCheck, UserX } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'
import { setActivityStatusVisible } from '../firebase/presenceService.js'
import { useAuth } from '../context/AuthContext.jsx'
import SettingsPageShell, { Notice } from '../components/settings/SettingsPageShell.jsx'
import { Card, IconTile, ListRow, RowGroup, Switch, Toast } from '../components/ui/Premium.jsx'

const MESSAGE_OPTIONS = [
  { value: 'everyone', label: 'Everyone', description: 'Any signed-in student can send you a message request', icon: Globe2 },
  { value: 'following', label: 'People you follow', description: 'Only people you follow can message you', icon: UserCheck }
]

/**
 * Real privacy settings. "Who can message me" is enforced by
 * chatService.assertMessagingAllowed (users/{uid}.messagePrivacy), and
 * activity status by presenceService — not display-only preferences.
 */
export default function PrivacySettingsPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid
  const [messagePrivacy, setMessagePrivacy] = useState('everyone')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ message: '', tone: 'neutral' })
  const toastTimer = useRef(null)
  const { profile: liveProfile } = useAuth()
  const activityVisible = liveProfile ? liveProfile.activityStatusVisible !== false : null
  const [activitySaving, setActivitySaving] = useState(false)

  const flash = (message, tone = 'neutral') => {
    setToast({ message, tone })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast({ message: '', tone: 'neutral' }), tone === 'error' ? 2600 : 1700)
  }
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (!currentUid) {
      setError('Not signed in.')
      setLoading(false)
      return
    }
    getUserProfile(currentUid)
      .then((profile) => setMessagePrivacy(profile?.messagePrivacy === 'following' ? 'following' : 'everyone'))
      .catch((err) => setError(err?.message || 'Could not load your privacy settings.'))
      .finally(() => setLoading(false))
  }, [currentUid])

  const toggleActivityStatus = async () => {
    if (!currentUid || activitySaving || activityVisible === null) return
    setActivitySaving(true)
    try {
      await setActivityStatusVisible(currentUid, !activityVisible)
      flash(!activityVisible ? 'Activity status is visible' : 'Activity status hidden')
    } catch (err) {
      flash(err?.message || "Couldn't update this setting.", 'error')
    } finally {
      setActivitySaving(false)
    }
  }

  const handleSelect = async (value) => {
    if (!currentUid || saving || value === messagePrivacy) return
    setSaving(true)
    const previous = messagePrivacy
    setMessagePrivacy(value)
    try {
      await updateUserProfile(currentUid, { messagePrivacy: value })
      flash('Privacy updated')
    } catch (err) {
      setMessagePrivacy(previous)
      flash(err?.message || "Couldn't update this setting.", 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsPageShell title="Privacy" description="Control who can reach you and what others can see.">
      {loading ? (
        <div className="py-16 flex justify-center" role="status" aria-label="Loading privacy settings">
          <Loader size="md" tone="dark" />
        </div>
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <div className="px-4 pt-2 space-y-5">
          <div>
            <h2 id="who-can-message" className="px-1 pb-2 text-[11.5px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.08em]">Who can message me</h2>
            <Card as="div" role="radiogroup" aria-labelledby="who-can-message" className="overflow-hidden divide-y divide-gray-100 dark:divide-white/10">
              {MESSAGE_OPTIONS.map((option) => {
                const on = messagePrivacy === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => handleSelect(option.value)}
                    disabled={saving}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[64px] text-left transition-colors duration-150 disabled:opacity-60 ${on ? 'bg-blue-50/60 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}`}
                  >
                    <IconTile icon={option.icon} tone={on ? 'blue' : 'slate'} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] font-semibold text-gray-900 dark:text-gray-50">{option.label}</span>
                      <span className="block text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">{option.description}</span>
                    </span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'border-blue-600' : 'border-gray-300 dark:border-white/20'}`} aria-hidden="true">
                      {on && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </span>
                  </button>
                )
              })}
            </Card>
          </div>

          <RowGroup label="Activity status">
            <div className="flex items-center gap-3 pl-4 pr-2 py-2 min-h-[72px]">
              <IconTile icon={Activity} tone="emerald" />
              <div className="flex-1 min-w-0">
                <p className="text-[14.5px] font-semibold text-gray-900 dark:text-gray-50">Show activity status</p>
                <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">
                  Let people see when you're active. If you turn this off, you won't see theirs either.
                </p>
              </div>
              <Switch checked={activityVisible === true} label="Show activity status" disabled={activityVisible === null || activitySaving} onChange={toggleActivityStatus} />
            </div>
          </RowGroup>

          <RowGroup label="People">
            <ListRow icon={UserX} tone="rose" title="Blocked users" description="Manage accounts you've blocked" onClick={() => navigate('/settings/blocked-users')} />
            <ListRow icon={Star} tone="amber" title="Close Friends" description="Who sees your Close Friends stories" onClick={() => navigate('/settings/close-friends')} />
          </RowGroup>
        </div>
      )}
      <Toast message={toast.message} tone={toast.tone} />
    </SettingsPageShell>
  )
}
