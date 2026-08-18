import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { Camera, Sparkles, Upload, X } from 'lucide-react'
import ImageCropper from './ImageCropper.jsx'
import CampinityAvatarPicker from './CampinityAvatarPicker.jsx'
import { uploadToQuarantine } from './quarantineUpload.js'
import { moderateImage } from '../moderation/imageModeration.js'
import { updateUserProfile, getUserProfile } from '../firebase/profileService.js'
import { auth } from '../firebase/firebase.js'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // matches the existing campusAvatars Storage rule's own 10MB limit — no client/server mismatch
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function mapStorageError(err) {
  switch (err?.code) {
    case 'storage/unauthorized':
      return "You don't have permission to update this photo."
    case 'storage/unauthenticated':
      return 'Please sign in again to update your photo.'
    case 'storage/invalid-argument':
      return "That image couldn't be processed. Try a different photo."
    case 'storage/quota-exceeded':
      return "We're at capacity right now. Please try again shortly."
    case 'storage/canceled':
      return 'Upload canceled.'
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out. Check your connection and try again.'
    default:
      return "Couldn't upload your photo. Please try again."
  }
}

/**
 * Direct profile-photo flow — distinct from CampusAvatarFlow.jsx,
 * which is specifically the AI-stylized avatar generator (a separate
 * existing feature, confirmed by reading it). This writes to
 * profile.avatar, the actual direct-photo field getProfileIdentityImage
 * already reads as a fallback — not campusAvatarUrl/avatarMode, which
 * belong to that other feature's own state.
 *
 * Uploads to a quarantine path first, then moderates before ever
 * reaching the real campusAvatars/{uid}/... Storage path (see
 * quarantineUpload.js and imageModeration.js) — the SAFE decision
 * path lands at the same final path/URL shape uploadCampusAvatar used
 * to write to directly, so profile.avatar (the actual, existing field
 * getProfileIdentityImage already reads) still receives the same kind
 * of value as before.
 */
export default function ProfilePhotoEditor({ open, onClose, currentPhotoUrl, onSaved }) {
  const [stage, setStage] = useState('sheet') // 'sheet' | 'cropper' | 'error'
  const [rawImageUrl, setRawImageUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [debugError, setDebugError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  // Root-cause fix: the previous version used the `uid` prop
  // (profile?.uid from ProfileHeader.jsx) as the upload's authority —
  // a derived value that was confirmed undefined at the moment of
  // upload (the exact "You need to be signed in" error traced back to
  // uploadCampusAvatar's own !uid guard). This resolves the real,
  // live Firebase Auth SDK state directly instead, matching the
  // explicit instruction: "never trust a UID coming from editable
  // client state when deciding authorization."
  const [authStatus, setAuthStatus] = useState('loading') // 'loading' | 'ready' | 'signed-out'
  const [authUid, setAuthUid] = useState(null)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [pickerProfile, setPickerProfile] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[ProfilePhotoUpload] auth state:', {
        uid: user?.uid,
        email: user?.email,
        status: user ? 'ready' : 'signed-out'
      })
      if (user) {
        setAuthUid(user.uid)
        setAuthStatus('ready')
        console.log('[ProfilePhotoUpload] AUTH READY')
        console.log('[ProfilePhotoUpload] AUTH USER UID:', user.uid)
      } else {
        setAuthUid(null)
        setAuthStatus('signed-out')
      }
    })
    return unsubscribe
  }, [open])

  if (!open) return null

  const handleOpenAvatarPicker = async () => {
    if (!authUid) return
    const profile = await getUserProfile(authUid).catch(() => null)
    setPickerProfile(profile)
    setAvatarPickerOpen(true)
  }

  const resetAndClose = () => {
    setStage('sheet')
    setRawImageUrl('')
    setErrorMessage('')
    setDebugError(null)
    setAvatarPickerOpen(false)
    setPickerProfile(null)
    onClose()
  }

  const handleFileSelected = (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-selecting the same file later
    if (!file) return
    console.log('[ProfilePhotoUpload]', { fileName: file.name, fileType: file.type, fileSize: file.size })

    if (authStatus === 'loading') {
      setErrorMessage('Checking your account…')
      setStage('error')
      return
    }
    if (authStatus === 'signed-out' || !authUid) {
      setErrorMessage('Please sign in again to update your photo.')
      setStage('error')
      return
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage("That file type isn't supported. Try a JPG, PNG or WEBP.")
      setStage('error')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('That image is too large. Try one under 10 MB.')
      setStage('error')
      return
    }

    setRawImageUrl(URL.createObjectURL(file))
    setStage('cropper')
  }

  const handleCropSave = async (blob) => {
    setSaving(true)
    const debugTag = '[ProfilePhotoUpload]'

    // Defensive re-check — auth could theoretically sign out between
    // file selection and clicking Save in the cropper (rare, but the
    // check is cheap and this is exactly the class of bug being fixed).
    if (!authUid) {
      console.error(debugTag, 'UPLOAD BLOCKED — no authenticated uid at save time')
      setErrorMessage('Please sign in again to update your photo.')
      setStage('error')
      setSaving(false)
      return
    }

    console.log(debugTag, { uid: authUid, blobType: blob.type, blobSize: blob.size })

    let quarantinePath
    try {
      console.log(debugTag, 'QUARANTINE UPLOAD STARTED')
      quarantinePath = await uploadToQuarantine(authUid, blob)
      console.log(debugTag, 'QUARANTINE UPLOAD SUCCESS:', quarantinePath)
    } catch (err) {
      console.error(debugTag, 'QUARANTINE UPLOAD FAILED', { code: err?.code, message: err?.message })
      setErrorMessage(mapStorageError(err))
      setDebugError(err)
      setStage('error')
      setSaving(false)
      return
    }

    let moderationResult
    try {
      console.log(debugTag, 'MODERATION STARTED')
      moderationResult = await moderateImage({ quarantinePath })
      console.log(debugTag, 'MODERATION RESULT:', moderationResult.decision)
    } catch (err) {
      // Provider/network failure — requirement 12: do NOT publish,
      // keep quarantined, show the exact retry message specified.
      // The quarantined file itself is untouched server-side.
      console.error(debugTag, 'MODERATION UNAVAILABLE', { code: err?.code, message: err?.message })
      setErrorMessage('Your image is being checked. Please try again shortly.')
      setDebugError(err)
      setStage('error')
      setSaving(false)
      return
    }

    if (moderationResult.decision === 'BLOCK') {
      setErrorMessage("That photo doesn't meet Campinity's guidelines. Please try a different one.")
      setStage('error')
      setSaving(false)
      return
    }

    if (moderationResult.decision === 'REVIEW') {
      setErrorMessage("Your photo is under review — we'll update your profile once it's approved.")
      setStage('error')
      setSaving(false)
      return
    }

    // SAFE — moderationResult.finalUrl is the real, final public URL
    // the Cloud Function already copied the file to.
    const url = moderationResult.finalUrl

    try {
      console.log(debugTag, 'Firestore update started')
      await updateUserProfile(authUid, { avatar: url })
      console.log(debugTag, 'Firestore update completed. final URL:', url)
      onSaved?.(url)
      resetAndClose()
    } catch (err) {
      console.error(debugTag, 'FIRESTORE UPDATE FAILED (Storage upload DID succeed — image exists at', url, ')', {
        code: err?.code,
        message: err?.message,
        err
      })
      setErrorMessage(
        err?.code === 'permission-denied'
          ? "Couldn't save your photo to your profile. Please try again."
          : "Couldn't update your profile. Please try again."
      )
      setDebugError(err)
      setStage('error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!authUid) {
      setErrorMessage('Please sign in again to update your photo.')
      setStage('error')
      return
    }
    setSaving(true)
    try {
      await updateUserProfile(authUid, { avatar: '' })
      onSaved?.('')
      resetAndClose()
    } catch (err) {
      console.error('Could not remove photo:', err)
      setErrorMessage("Couldn't remove your photo. Please try again.")
      setStage('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    {createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={resetAndClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 pb-8 sm:pb-5 shadow-xl">
        {authStatus === 'loading' && stage === 'sheet' && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500">Checking your account…</p>
          </div>
        )}

        {authStatus === 'signed-out' && stage === 'sheet' && (
          <div className="text-center py-6">
            <p className="text-sm font-semibold text-gray-900">Please sign in again</p>
            <p className="mt-1 text-sm text-gray-400">Your session couldn't be verified.</p>
          </div>
        )}

        {authStatus === 'ready' && stage === 'sheet' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold text-gray-900">Change profile photo</p>
              <button type="button" aria-label="Close" onClick={resetAndClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50 transition-all duration-200"
              >
                <Upload className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">Upload from device</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.setAttribute('capture', 'user')
                  fileInputRef.current?.click()
                }}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50 transition-all duration-200"
              >
                <Camera className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">Take a photo</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAvatarPicker}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-gray-50 transition-all duration-200"
              >
                <span className="w-5 h-5 flex items-center justify-center text-base">🎭</span>
                <span className="text-sm font-semibold text-gray-900">Choose Campinity Avatar</span>
              </button>
              <div className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left opacity-40 cursor-not-allowed" aria-disabled="true">
                <Sparkles className="w-5 h-5 text-gray-400" />
                <div>
                  <span className="text-sm font-semibold text-gray-500">AI Avatar</span>
                  <span className="block text-[11px] text-gray-400">Coming soon</span>
                </div>
              </div>
              {currentPhotoUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={saving}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-red-50 transition-all duration-200 disabled:opacity-60"
                >
                  <X className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-semibold text-red-600">{saving ? 'Removing...' : 'Remove photo'}</span>
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleFileSelected} />
          </>
        )}

        {stage === 'cropper' && (
          <>
            <p className="text-center text-sm font-semibold text-gray-900 mb-4">Adjust your photo</p>
            <ImageCropper imageUrl={rawImageUrl} onCancel={resetAndClose} onSave={handleCropSave} />
          </>
        )}

        {stage === 'error' && (
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900">{errorMessage}</p>
            {debugError && (
              <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-left">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Debug (temporary)</p>
                <p className="text-xs font-mono text-gray-700 break-all">code: {debugError.code || 'none'}</p>
                <p className="text-xs font-mono text-gray-700 break-all">message: {debugError.message || 'none'}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStage('sheet')}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )}

    <CampinityAvatarPicker
      open={avatarPickerOpen}
      onClose={() => setAvatarPickerOpen(false)}
      profile={pickerProfile}
      onSaved={(url) => {
        onSaved?.(url)
        resetAndClose()
      }}
    />
    </>
  )
}
