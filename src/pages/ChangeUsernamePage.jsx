import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AtSign, Check, Loader2, X } from 'lucide-react'
import SettingsPageShell, { Notice, fieldCls, primaryBtn } from '../components/settings/SettingsPageShell.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { auth } from '../firebase/firebase.js'
import { useUsernameAvailability } from '../hooks/useUsernameAvailability.js'
import { normalizeUsername, reserveUsername } from '../firebase/usernameService.js'

/**
 * Change username — the real reservation system (usernameService.reserveUsername):
 * one Firestore transaction reserves usernames/{new}, keeps the old name as a
 * 30-day alias of this account, and updates users/{uid}.username. Firestore
 * rules reject a username on a profile that isn't reserved by the same user.
 */
export default function ChangeUsernamePage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const current = profile?.username || ''
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const check = useUsernameAvailability(value, current)
  const normalized = normalizeUsername(value)
  const canSave = check.status === 'available' && !saving

  const save = async (e) => {
    e.preventDefault()
    if (!canSave || !auth.currentUser) return
    setSaving(true)
    setError('')
    try {
      const reserved = await reserveUsername({ uid: auth.currentUser.uid, newUsername: normalized, oldUsername: current })
      setDone(reserved)
      setValue('')
    } catch (err) {
      setError(err?.code === 'username-taken' ? 'Someone just took that username. Try another.' : err?.code === 'invalid-username' ? err.message : err?.code === 'permission-denied' ? "You can't use that username." : 'Could not change your username. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const statusLine = {
    checking: { icon: Loader2, cls: 'text-gray-500 animate-spin', text: 'Checking…' },
    available: { icon: Check, cls: 'text-emerald-600', text: `@${normalized} is available` },
    taken: { icon: X, cls: 'text-red-600', text: 'That username is taken' },
    invalid: { icon: X, cls: 'text-red-600', text: check.message },
    unchanged: { icon: Check, cls: 'text-gray-500', text: "That's your current username" },
    error: { icon: X, cls: 'text-red-600', text: 'Network error — try again' }
  }[check.status]

  return (
    <SettingsPageShell title="Username" back="/settings/account">
      <div className="px-4 pt-3">
        <p className="text-[12px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Current</p>
        <p className="mt-1 text-[17px] font-bold text-gray-900 dark:text-gray-50">{current ? `@${current}` : 'No username yet'}</p>
      </div>

      {done && (
        <Notice tone="success">
          Your username is now <strong>@{done}</strong>. Your old username keeps pointing to your profile for 30 days, so existing links and mentions still work.
        </Notice>
      )}

      <form onSubmit={save} className="px-4 pt-5 space-y-3">
        <label className="block">
          <span className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">New username</span>
          <div className="relative">
            <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setDone('')
                setError('')
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={24}
              placeholder="new_username"
              aria-describedby="username-rules username-status"
              className={`${fieldCls} pl-10`}
            />
          </div>
        </label>
        <div id="username-status" aria-live="polite" className="min-h-[20px]">
          {statusLine && (
            <p className="flex items-center gap-1.5 text-[13px]">
              <statusLine.icon className={`w-4 h-4 ${statusLine.cls}`} />
              <span className={statusLine.cls.replace('animate-spin', '')}>{statusLine.text}</span>
            </p>
          )}
        </div>
        <p id="username-rules" className="text-[12px] text-gray-500 dark:text-gray-400">3–20 characters: lowercase letters, numbers and underscores.</p>
        {error && <p role="alert" className="text-[13px] text-red-600">{error}</p>}
        <button type="submit" disabled={!canSave} className={primaryBtn}>
          {saving ? 'Saving…' : 'Change username'}
        </button>
        <button type="button" onClick={() => navigate('/settings/account')} className="w-full py-2 text-[14px] font-semibold text-gray-600 dark:text-gray-300">
          Cancel
        </button>
      </form>
    </SettingsPageShell>
  )
}
