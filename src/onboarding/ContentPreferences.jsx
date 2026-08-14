import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'

/**
 * Phase 1 slice: "What should Campinity help you with?" — mapped to
 * REAL post category values (general, study, notes, event, club,
 * marketplace — confirmed by reading CreatePostPage.jsx directly),
 * not the brief's suggested interest chips (Tech/Sports/Music/etc),
 * since those have no real backing field on posts and picking them
 * would mean either fabricating a new post-tagging system (out of
 * scope) or building a selector that silently does nothing.
 *
 * Deliberately NOT integrated into the real onboarding wizard —
 * CreateProfilePage.jsx and the rest of src/auth/ were never provided
 * to me this session (confirmed absent from my working directory),
 * so building this as a standalone settings section avoids creating
 * a second, competing, un-integrated onboarding flow. This can be
 * wired into the real wizard once that file is available.
 */
const CONTENT_TYPES = [
  { key: 'study', label: 'Study resources', emoji: '📚' },
  { key: 'event', label: 'Events', emoji: '🎉' },
  { key: 'club', label: 'Communities', emoji: '👥' },
  { key: 'marketplace', label: 'Student deals', emoji: '🛍️' },
  { key: 'general', label: 'Campus discussions', emoji: '💬' }
]

export default function ContentPreferences() {
  const [selected, setSelected] = useState(null) // null = not loaded yet
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getUserProfile(uid)
      .then((profile) => setSelected(profile?.preferences?.contentTypes || []))
      .catch(() => setSelected([]))
  }, [])

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleSave = async () => {
    const uid = auth.currentUser?.uid
    if (!uid || saving) return
    setSaving(true)
    try {
      await updateUserProfile(uid, { preferences: { contentTypes: selected } })
    } catch (err) {
      console.error('Could not save preferences:', err)
    } finally {
      setSaving(false)
    }
  }

  if (selected === null) return null

  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <p className="text-sm font-bold text-gray-900">What should Campinity help you with?</p>
      <p className="text-xs text-gray-400 mt-0.5">This shapes what shows up first in your feed.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {CONTENT_TYPES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition-all duration-200 ${
              selected.includes(c.key) ? 'border-blue-500 bg-blue-50' : 'border-gray-100'
            }`}
          >
            <span className="text-base">{c.emoji}</span>
            <span className="text-xs font-semibold text-gray-900 flex-1">{c.label}</span>
            {selected.includes(c.key) && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-3 w-full rounded-full bg-blue-600 text-white text-xs font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
      >
        {saving ? 'Saving...' : 'Save preferences'}
      </button>
    </div>
  )
}
