import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Image as ImageIcon, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Switch from '../components/Switch.jsx'
import { usePosts } from '../hooks/usePosts.jsx'
import { currentUserProfile } from '../data/dummyProfile.js'

const categories = ['general', 'study', 'notes', 'event', 'club', 'marketplace']

const categoryLabels = {
  general: 'General',
  study: 'Study',
  notes: 'Notes',
  event: 'Event',
  club: 'Club',
  marketplace: 'Marketplace'
}

const MAX_LENGTH = 500

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreatePostPage() {
  const navigate = useNavigate()
  const { addPost } = usePosts()
  const imageInputRef = useRef(null)
  const pdfInputRef = useRef(null)

  const [postText, setPostText] = useState('')
  const [category, setCategory] = useState('general')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [error, setError] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setError('')
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreviewUrl('')
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handlePdfChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPdfFile(file)
    setError('')
  }

  const removePdf = () => {
    setPdfFile(null)
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  const hasContent = postText.trim().length > 0 || Boolean(imageFile) || Boolean(pdfFile)
  const notesNeedsFile = category === 'notes' && !pdfFile
  const isValid = hasContent && !notesNeedsFile

  const handlePublish = async () => {
    if (!hasContent) {
      setError('Write something or attach a file before publishing.')
      return
    }
    if (notesNeedsFile) {
      setError('Notes posts need a PDF attached.')
      return
    }
    if (isPublishing) return

    setError('')
    setIsPublishing(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const author = isAnonymous
      ? {
          name: 'Anonymous',
          username: 'anonymous',
          initials: '?',
          avatarColor: 'from-gray-400 to-gray-500',
          department: '',
          year: '',
          college: currentUserProfile.college
        }
      : {
          name: currentUserProfile.name,
          username: currentUserProfile.username,
          initials: currentUserProfile.initials,
          avatarColor: currentUserProfile.colorClass,
          department: currentUserProfile.department,
          year: currentUserProfile.year,
          college: currentUserProfile.college
        }

    const trimmedText = postText.trim()

    const newPost = {
      id: `local-${Date.now()}`,
      type: category,
      name: author.name,
      username: author.username,
      initials: author.initials,
      avatarColor: author.avatarColor,
      department: author.department,
      year: author.year,
      college: author.college,
      time: 'Just now',
      text: trimmedText,
      likes: 0,
      comments: 0,
      likedByMe: false,
      feedCategories: ['forYou'],
      ...(pdfFile ? { file: { name: pdfFile.name, size: formatFileSize(pdfFile.size) } } : {}),
      ...(imagePreviewUrl ? { imagePreviewUrl } : {}),
      ...(category === 'event'
        ? {
            event: {
              title: trimmedText.slice(0, 60) || 'New event',
              date: 'See post for details',
              location: 'See post for details'
            }
          }
        : {}),
      ...(category === 'marketplace'
        ? { marketplace: { item: trimmedText.slice(0, 60) || 'New listing', price: 'See post for price' } }
        : {})
    }

    addPost(newPost)
    setIsPublishing(false)
    navigate('/home')
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-3">
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => navigate('/home')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">New Post</span>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isValid || isPublishing}
              className="rounded-full bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </header>

        <div className="px-4 py-4 pb-24 space-y-5">
          <div className="flex items-center gap-3">
            <Avatar
              initials={isAnonymous ? '?' : currentUserProfile.initials}
              colorClass={isAnonymous ? 'from-gray-400 to-gray-500' : currentUserProfile.colorClass}
              size="md"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {isAnonymous ? 'Anonymous' : currentUserProfile.name}
              </p>
              <p className="text-xs text-gray-400">
                {isAnonymous ? 'Your identity is hidden' : `@${currentUserProfile.username}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Anonymous</span>
              <Switch checked={isAnonymous} onChange={setIsAnonymous} label="Post anonymously" />
            </div>
          </div>

          <div>
            <textarea
              autoFocus
              rows={5}
              maxLength={MAX_LENGTH}
              value={postText}
              onChange={(event) => {
                setPostText(event.target.value)
                setError('')
              }}
              placeholder="What's happening on campus?"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {postText.length}/{MAX_LENGTH}
            </p>
          </div>

          <div className="space-y-2.5">
            {imagePreviewUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-100">
                <img src={imagePreviewUrl} alt="Selected preview" className="w-full max-h-56 object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  aria-label="Remove image"
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all duration-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3.5 hover:border-blue-200 hover:bg-blue-50/40 transition-all duration-300"
              >
                <ImageIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Add a photo</span>
              </button>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />

            {pdfFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{pdfFile.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(pdfFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={removePdf}
                  aria-label="Remove PDF"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3.5 hover:border-blue-200 hover:bg-blue-50/40 transition-all duration-300"
              >
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Add a PDF</span>
              </button>
            )}
            <input ref={pdfInputRef} type="file" accept="application/pdf" className="sr-only" onChange={handlePdfChange} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setCategory(key)
                    setError('')
                  }}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
                    category === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {categoryLabels[key]}
                </button>
              ))}
            </div>
            {notesNeedsFile && (
              <p className="mt-2 text-xs text-amber-600">Notes posts need a PDF attached before publishing.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isValid || isPublishing}
              className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}