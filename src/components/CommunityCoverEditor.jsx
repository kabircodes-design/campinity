import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import ImageCropper from '../avatar/ImageCropper.jsx'
import { uploadCommunityAsset, updateCommunityDetails } from '../firebase/communityService.js'
import { auth } from '../firebase/firebase.js'

const MAX_FILE_SIZE = 15 * 1024 * 1024 // matches the existing communities/{id}/{filename} Storage rule's own 15MB limit
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Cover/avatar upload for community owners/admins — the backend was
 * already fully ready before this component existed (uploadCommunityAsset,
 * the coverImage/icon fields, and the owner/admin-only Storage rule all
 * predate this work, confirmed by reading communityService.js and
 * storage.rules directly). This is purely the missing UI layer.
 * Reuses ImageCropper.jsx as-is — the same component built and debugged
 * for profile photos — rather than building a second cropper.
 */
export default function CommunityCoverEditor({ open, onClose, communityId, kind, onSaved }) {
  const [stage, setStage] = useState('picker') // 'picker' | 'cropper' | 'error'
  const [rawImageUrl, setRawImageUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  if (!open) return null

  const label = kind === 'cover' ? 'cover photo' : 'community icon'

  const resetAndClose = () => {
    setStage('picker')
    setRawImageUrl('')
    setErrorMessage('')
    onClose()
  }

  const handleFileSelected = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage("That file type isn't supported. Try a JPG, PNG or WEBP.")
      setStage('error')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('That image is too large. Try one under 15 MB.')
      setStage('error')
      return
    }

    setRawImageUrl(URL.createObjectURL(file))
    setStage('cropper')
  }

  const handleCropSave = async (blob) => {
    setSaving(true)
    try {
      const url = await uploadCommunityAsset(communityId, blob, kind)
      await updateCommunityDetails(communityId, auth.currentUser?.uid, { [kind === 'cover' ? 'coverImage' : 'icon']: url })
      onSaved?.(url)
      resetAndClose()
    } catch (err) {
      console.error('Community asset upload failed:', err)
      setErrorMessage(`Couldn't update the ${label}. Please try again.`)
      setStage('error')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={resetAndClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white p-5 pb-8 sm:pb-5 shadow-xl">
        {stage === 'picker' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold text-gray-900">Change {label}</p>
              <button type="button" aria-label="Close" onClick={resetAndClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 transition-all duration-200"
            >
              Upload from device
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleFileSelected} />
          </>
        )}

        {stage === 'cropper' && (
          <>
            <p className="text-center text-sm font-semibold text-gray-900 mb-4">Adjust your {label}</p>
            <ImageCropper imageUrl={rawImageUrl} onCancel={resetAndClose} onSave={handleCropSave} />
          </>
        )}

        {stage === 'error' && (
          <div className="text-center py-4">
            <p className="text-sm font-semibold text-gray-900">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setStage('picker')}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
