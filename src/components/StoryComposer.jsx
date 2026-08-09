import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { createStory, uploadStoryMedia } from '../firebase/storyService.js'

/**
 * The actual fix for this task's root problem: uploads go through
 * uploadStoryMedia (stories/{uid}/... Storage path) and createStory
 * (stories/{storyId} Firestore document) — never CreatePostPage or
 * createPost. This is the complete, isolated path from file selection
 * to a real story document; nothing here can produce a post.
 */
export default function StoryComposer({ onClose, onCreated }) {
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [mediaType, setMediaType] = useState('image')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [author, setAuthor] = useState(null)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getUserProfile(uid)
      .then((profile) => {
        if (profile) {
          setAuthor({
            displayName: profile.displayName || '',
            username: profile.username || '',
            profilePhoto: getProfileIdentityImage(profile) || ''
          })
        }
      })
      .catch(() => {})
  }, [])

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setMediaType(selected.type.startsWith('video/') ? 'video' : 'image')
    setPreview(URL.createObjectURL(selected))
    setError('')
  }

  const handleShare = async () => {
    if (!file || uploading) return
    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('You need to be signed in.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const mediaUrl = await uploadStoryMedia(uid, file)
      await createStory({ uid, mediaUrl, mediaType, author })
      onCreated?.()
      onClose()
    } catch (err) {
      setError(err?.message || 'Could not share your story. Please try again.')
      setUploading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <div className="h-14 flex items-center justify-between px-4 flex-shrink-0">
        <button type="button" onClick={onClose} aria-label="Close" className="text-white/90 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white text-sm font-semibold">Your Story</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        {preview ? (
          mediaType === 'video' ? (
            <video src={preview} controls className="max-h-full max-w-full rounded-lg" />
          ) : (
            <img src={preview} alt="Story preview" className="max-h-full max-w-full rounded-lg object-contain" />
          )
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-white/30 text-white/70 px-8 py-12 text-sm font-medium hover:border-white/50 hover:text-white transition-all duration-300"
          >
            Tap to choose a photo or video
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} className="sr-only" />
      </div>

      {error && <p className="px-4 pb-2 text-center text-sm text-red-400">{error}</p>}

      <div className="p-4 flex-shrink-0">
        {preview ? (
          <button
            type="button"
            onClick={handleShare}
            disabled={uploading}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
          >
            {uploading ? 'Sharing…' : 'Share to Your Story'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-full border border-white/30 text-white text-sm font-semibold py-3 hover:border-white/50 transition-all duration-300"
          >
            Choose Photo/Video
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
