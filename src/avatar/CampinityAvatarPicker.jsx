import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { Check, X } from 'lucide-react'
import { AVATAR_CATEGORIES, CAMPINITY_AVATARS } from './campinityAvatars.js'
import { updateUserProfile } from '../firebase/profileService.js'
import { auth } from '../firebase/firebase.js'
import { getProfileIdentityImage } from './profileIdentity.js'

/**
 * Preset Campinity Avatar picker — Phase 1, no AI generation (that
 * "✨ AI Avatar — Coming soon" entry lives in ProfilePhotoEditor.jsx,
 * visibly disabled, never wired to anything here).
 *
 * Reuses the EXISTING campusAvatarUrl/avatarMode fields — confirmed
 * real by reading profileService.js and profileIdentity.js directly,
 * not invented. Saving here is exactly:
 *   updateUserProfile(uid, { campusAvatarUrl: <svg data URL>, avatarMode: 'avatar' })
 * which is the same write path CampusAvatarFlow.jsx's AI-generator
 * feature already uses for these two fields — no new field, no new
 * write path, no schema change. Because getProfileIdentityImage
 * already reads these two fields with this exact priority, every
 * existing <img src={getProfileIdentityImage(profile)}> across the
 * whole app picks up the new avatar automatically — no other file
 * needs to change for "same avatar everywhere" to be true.
 *
 * Does NOT delete the existing `avatar` (real photo) field — matches
 * the explicit 'switching to avatar must not delete the uploaded
 * photo' requirement. Switching back to the photo is exactly setting
 * avatarMode back to 'photo', which ProfilePhotoEditor.jsx's own
 * photo-upload/remove flow already does implicitly by never touching
 * avatarMode itself... except it doesn't currently set it explicitly,
 * so this picker's "switch back" affordance sets it explicitly to be
 * safe and correct rather than relying on an implicit default.
 */
export default function CampinityAvatarPicker({ open, onClose, profile, onSaved }) {
  const [activeCategory, setActiveCategory] = useState(AVATAR_CATEGORIES[0].key)
  const [selectedUrl, setSelectedUrl] = useState(profile?.campusAvatarUrl || null)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [authUid, setAuthUid] = useState(auth.currentUser?.uid || null)

  useEffect(() => {
    if (!open) return undefined
    const unsubscribe = onAuthStateChanged(auth, (user) => setAuthUid(user?.uid || null))
    return unsubscribe
  }, [open])

  if (!open) return null

  const visibleAvatars = CAMPINITY_AVATARS.filter((a) => a.category === activeCategory)
  const displayName = profile?.displayName || 'Student'
  const username = profile?.username || ''

  const handleUse = async () => {
    if (!selectedUrl || !authUid || saving) return
    setSaving(true)
    setErrorMessage('')
    try {
      await updateUserProfile(authUid, { campusAvatarUrl: selectedUrl, avatarMode: 'avatar' })
      onSaved?.(selectedUrl)
      onClose()
    } catch (err) {
      console.error('[CampinityAvatar] save failed:', { code: err?.code, message: err?.message, err })
      setErrorMessage("Couldn't save your avatar. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ backgroundColor: '#f3f0fb' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 500px 400px at 10% -10%, rgba(147,112,255,0.28), transparent 55%), radial-gradient(ellipse 400px 350px at 100% 100%, rgba(236,72,153,0.18), transparent 55%)'
          }}
        />

        <div className="relative bg-white/50 backdrop-blur-2xl border-b border-white/50 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Choose your Campinity Avatar</p>
            <p className="text-xs text-gray-500 mt-0.5">Show your vibe without sharing your real photo.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-white/60 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex items-center gap-1.5 px-5 py-3 overflow-x-auto scroll-hidden border-b border-white/40">
          {AVATAR_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`flex-shrink-0 flex items-center gap-1 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                activeCategory === cat.key
                  ? 'bg-gradient-to-r from-blue-50/90 to-indigo-50/70 text-blue-700 shadow-[inset_0_0_0_1px_rgba(91,77,255,0.14)]'
                  : 'bg-white/40 text-gray-500 hover:bg-white/60'
              }`}
            >
              <span>{cat.emoji}</span> {cat.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 overflow-y-auto flex flex-col sm:flex-row">
          <div className="flex-1 p-5">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {visibleAvatars.map((avatar) => {
                const isSelected = selectedUrl === avatar.url
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    aria-label={`${avatar.category} avatar ${avatar.id}`}
                    onClick={() => setSelectedUrl(avatar.url)}
                    className={`relative aspect-square rounded-2xl overflow-hidden bg-white/40 backdrop-blur-sm border transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-400/50 shadow-[0_0_0_4px_rgba(91,77,255,0.12)]'
                        : 'border-white/50 hover:border-white/70 hover:bg-white/55'
                    }`}
                  >
                    <img src={avatar.url} alt="" className="w-full h-full object-cover" />
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="sm:w-56 flex-shrink-0 p-5 sm:border-l border-white/40 flex flex-col items-center justify-center bg-white/25">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your profile</p>
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/70 shadow-sm bg-white/40">
              <img
                src={selectedUrl || getProfileIdentityImage(profile) || undefined}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <p className="mt-3 text-sm font-bold text-gray-900">{displayName}</p>
            {username && <p className="text-xs text-gray-400">@{username}</p>}
          </div>
        </div>

        {errorMessage && (
          <p className="relative px-5 py-2 text-xs text-red-600 bg-red-50/80">{errorMessage}</p>
        )}

        <div className="relative bg-white/50 backdrop-blur-2xl border-t border-white/50 px-5 py-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/60 bg-white/40 text-gray-700 text-sm font-semibold py-2.5 hover:bg-white/60 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUse}
            disabled={!selectedUrl || saving}
            className="flex-1 rounded-full bg-blue-600/90 backdrop-blur-sm text-white text-sm font-semibold py-2.5 hover:bg-blue-700/90 disabled:opacity-50 transition-all duration-200"
          >
            {saving ? 'Using avatar...' : 'Use Avatar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
