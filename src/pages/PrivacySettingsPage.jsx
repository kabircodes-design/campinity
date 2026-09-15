import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronRight, UserX } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'

const MESSAGE_OPTIONS = [
  { value: 'everyone', label: 'Everyone', description: 'Any signed-in student can send you a message request' },
  { value: 'following', label: 'People you follow', description: "Only people you follow can message you" }
]

/**
 * The real Privacy page — App.jsx's /settings/privacy route previously
 * rendered <ComingSoon>. "Who can message me" is real, enforced
 * server-of-truth via chatService.js's assertMessagingAllowed (see
 * that file), not a display-only preference — persisted on the
 * existing users/{uid} document as `messagePrivacy`, no new
 * collection. Blocked Users lives on its own page already (more
 * detail than a toggle needs); this links to it rather than
 * duplicating that list here.
 */
export default function PrivacySettingsPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [messagePrivacy, setMessagePrivacy] = useState('everyone')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

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

  const handleSelect = async (value) => {
    if (!currentUid || saving || value === messagePrivacy) return
    setSaving(true)
    const previous = messagePrivacy
    setMessagePrivacy(value)
    try {
      await updateUserProfile(currentUid, { messagePrivacy: value })
      setToast('Privacy updated')
      window.setTimeout(() => setToast(''), 1800)
    } catch (err) {
      setMessagePrivacy(previous)
      setToast(err?.message || "Couldn't update this setting.")
      window.setTimeout(() => setToast(''), 2200)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Privacy</span>
          </div>
        </header>

        <main className="px-4 py-4">
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : error ? (
            <p className="py-16 text-center text-sm text-gray-400">{error}</p>
          ) : (
            <>
              <p className="px-1 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Who can message me</p>
              <div className="rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                {MESSAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    disabled={saving}
                    aria-pressed={messagePrivacy === option.value}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-all duration-200 disabled:opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{option.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                    </div>
                    {messagePrivacy === option.value && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <p className="px-1 pt-6 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Blocking</p>
              <button
                type="button"
                onClick={() => navigate('/settings/blocked-users')}
                className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3.5 text-left hover:bg-gray-50 transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
                  <UserX className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Blocked users</p>
                  <p className="text-xs text-gray-400 mt-0.5">Manage accounts you've blocked</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            </>
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
