import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Mail, MessageCircle } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import SettingsItem from '../components/SettingsItem.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'

const MESSAGE_OPTIONS = [
  { value: 'everyone', label: 'Everyone', description: 'Any signed-in student can send you a message request' },
  { value: 'following', label: 'People you follow', description: 'Only people you follow can message you' }
]

/**
 * "Who can message you" here is the SAME users/{uid}.messagePrivacy
 * field PrivacySettingsPage.jsx already reads/writes (and
 * chatService.js already enforces server-side) — not a second,
 * competing preference. Read receipts have no backing implementation
 * (MessageBubble.jsx has no read-state field this session confirmed),
 * so it's shown honestly as disabled rather than a toggle that does
 * nothing.
 */
export default function MessagesSettingsPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [messagePrivacy, setMessagePrivacy] = useState('everyone')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!currentUid) {
      setLoading(false)
      return
    }
    getUserProfile(currentUid)
      .then((profile) => setMessagePrivacy(profile?.messagePrivacy === 'following' ? 'following' : 'everyone'))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentUid])

  const handleSelect = async (value) => {
    if (!currentUid || saving || value === messagePrivacy) return
    setSaving(true)
    const previous = messagePrivacy
    setMessagePrivacy(value)
    try {
      await updateUserProfile(currentUid, { messagePrivacy: value })
      setToast('Saved')
      window.setTimeout(() => setToast(''), 1500)
    } catch (err) {
      setMessagePrivacy(previous)
      setToast(err?.message || "Couldn't update this setting.")
      window.setTimeout(() => setToast(''), 2200)
    } finally {
      setSaving(false)
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
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Messages</span>
          </div>
        </header>

        <main className="py-2 pb-10">
          <SettingsItem
            icon={Mail}
            label="Message requests"
            description="View pending message requests"
            onClick={() => navigate('/messages/requests')}
          />

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : (
            <>
              <p className="px-4 pt-5 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Who can message me</p>
              <div className="mx-4 rounded-2xl border border-gray-100 divide-y divide-gray-100 dark:border-white/10 dark:divide-white/10 overflow-hidden">
                {MESSAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    disabled={saving}
                    aria-pressed={messagePrivacy === option.value}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200 disabled:opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{option.label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{option.description}</p>
                    </div>
                    {messagePrivacy === option.value && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="px-4 pt-5 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Preferences</p>
          <SettingsItem
            icon={MessageCircle}
            label="Read receipts"
            description="Coming soon"
            rightElement={<span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">Coming soon</span>}
          />
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
