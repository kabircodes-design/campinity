import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, Image as ImageIcon, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Switch from '../components/Switch.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { computeExpiresAt, createPost, getAvatarColor, getInitials, uploadPostDocument, uploadPostImage } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById } from '../firebase/communityService.js'
import { awardXP, getUserProgress } from '../gamification/xpService.js'
import { checkAndAwardBadges } from '../gamification/badgeService.js'
import { POINTS_REWARDS } from '../gamification/config.js'

const categories = ['general', 'study', 'notes', 'event', 'club', 'marketplace']

const categoryLabels = {
  general: 'General',
  study: 'Study',
  notes: 'Notes',
  event: 'Event',
  club: 'Club',
  marketplace: 'Marketplace'
}

const EXPIRATION_OPTIONS = [
  { key: '24h', label: '24 hours' },
  { key: '3d', label: '3 days' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'never', label: 'Never' }
]

const MAX_LENGTH = 500

/**
 * Post-To-Community assumption, stated plainly: createPost's `extra`
 * param already accepts arbitrary fields (category/isAnonymous were
 * already being passed through it before this change), so
 * communityId/communityName are added the same way rather than
 * changing createPost's signature. This assumes postService.js spreads
 * `extra` directly onto the created post document — I don't have that
 * file's real implementation to confirm it does. If it instead nests
 * `extra` under its own field, or only recognizes specific known keys,
 * communityId/communityName won't land on the post document as flat
 * fields, and every downstream query in this pass
 * (getCommunityFeedPosts, getCommunityMediaPosts) that filters posts
 * by a flat `communityId` field would return nothing.
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreatePostPage() {
  const navigate = useNavigate()
  const imageInputRef = useRef(null)
  const pdfInputRef = useRef(null)

  const [profile, setProfile] = useState(null)

  const [postText, setPostText] = useState('')
  const [category, setCategory] = useState('general')
  const [expirationType, setExpirationType] = useState('7d')
  const [noteSubject, setNoteSubject] = useState('')
  const [noteCollection, setNoteCollection] = useState('')
  const [noteChapter, setNoteChapter] = useState('')

  const NOTE_SUBJECTS = [
    { key: 'physics', label: 'Physics', emoji: '⚡' },
    { key: 'chemistry', label: 'Chemistry', emoji: '🧪' }
  ]
  const NOTE_COLLECTIONS = [
    { key: 'chapter1', label: 'Chapter 1' },
    { key: 'chapter2', label: 'Chapter 2' },
    { key: 'important', label: 'Important Questions' },
    { key: 'pyqs', label: 'PYQs' },
    { key: 'practicals', label: 'Practicals' }
  ]

  const CATEGORY_SUGGESTIONS = {
    event: '7d',
    notes: '30d',
    study: '7d',
    general: '7d',
    marketplace: '30d'
  }
  const suggestedExpiration = CATEGORY_SUGGESTIONS[category]

  const expiryPreviewText = useMemo(() => {
    if (expirationType === 'never') return 'Stays on Campinity until you remove it'
    const ts = computeExpiresAt(expirationType)
    if (!ts) return ''
    const date = ts.toDate()
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const isTomorrow =
      date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear()
    const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    if (isTomorrow) return `Expires tomorrow at ${timeStr}`
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Expires ${dateStr} at ${timeStr}`
  }, [expirationType])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [error, setError] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  const [postTarget, setPostTarget] = useState('public')
  const [myCommunities, setMyCommunities] = useState([])
  const [communitiesLoading, setCommunitiesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadProfile = async () => {
      const uid = auth.currentUser?.uid
      if (!uid) return
      try {
        const data = await getUserProfile(uid)
        if (!cancelled) setProfile(data)
      } catch {
        // The composer still works without a loaded profile preview —
        // publishing itself re-checks auth.currentUser directly.
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    const loadMyCommunities = async () => {
      if (!uid) {
        setCommunitiesLoading(false)
        return
      }
      try {
        const memberships = await getUserCommunityMemberships(uid)
        const communities = await Promise.all(
          memberships.map((membership) => getCommunityById(membership.communityId))
        )
        if (!cancelled) setMyCommunities(communities.filter(Boolean))
      } catch {
        // Post-To selector just falls back to "Public Feed only" if this fails.
      } finally {
        if (!cancelled) setCommunitiesLoading(false)
      }
    }

    loadMyCommunities()
    return () => {
      cancelled = true
    }
  }, [])

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
  const isValid = hasContent

  const displayName = profile?.displayName || ''
  const username = profile?.username || ''
  const initials = getInitials(displayName)

  const handlePublish = async () => {
    if (!hasContent) {
      setError('Write something or attach a file before publishing.')
      return
    }
    if (isPublishing) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setError('You need to be signed in to publish a post.')
      return
    }

    setError('')
    setIsPublishing(true)

    try {
      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadPostImage(uid, imageFile)
      }

      let fileData = null
      if (pdfFile) {
        const fileUrl = await uploadPostDocument(uid, pdfFile)
        fileData = { name: pdfFile.name, size: formatFileSize(pdfFile.size), url: fileUrl, mimeType: 'application/pdf' }
      }

      const author = isAnonymous
        ? { displayName: 'Anonymous', username: 'anonymous', profilePhoto: '' }
        : { displayName, username, profilePhoto: profile?.avatar || '' }

      const selectedCommunity =
        postTarget !== 'public' ? myCommunities.find((c) => c.id === postTarget) : null

      const newPostId = await createPost({
        uid,
        text: postText.trim(),
        imageUrl,
        author,
        extra: {
          category,
          isAnonymous,
          expirationType,
          expiresAt: computeExpiresAt(expirationType),
          ...(category === 'notes' && {
            subject: noteSubject || 'unassigned',
            collection: noteCollection || 'general',
            ...(noteChapter.trim() && { chapter: noteChapter.trim() })
          }),
          ...(fileData && { file: fileData }),
          ...(selectedCommunity && {
            communityId: selectedCommunity.id,
            communityName: selectedCommunity.name
          })
        }
      })

      // Gamification — deduped by the real, just-created post's own id.
      // Honest scope: this protects against the SAME post id ever
      // being awarded twice (e.g. if this award call itself were
      // retried after a transient failure) — it does NOT prevent two
      // genuinely separate posts from a true double-submit, since
      // createPost always writes a fresh document with a fresh id
      // regardless of dedup keys. The existing isPublishing guard
      // above (and the Publish button's own disabled state) already
      // prevents the common double-click case at the UI level before
      // this code is ever reached a second time.
      const postAward = await awardXP(uid, 'post_created', {
        campusPoints: POINTS_REWARDS.post_created || 0,
        dedupeKey: `post_created_${newPostId}`
      }).catch(() => null)
      if (postAward) {
        const progress = await getUserProgress(uid).catch(() => null)
        if (progress) await checkAndAwardBadges(uid, progress).catch(() => {})
      }

      navigate('/home')
    } catch (err) {
      setError(err?.message || 'Could not publish your post. Please try again.')
    } finally {
      setIsPublishing(false)
    }
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
              initials={isAnonymous ? '?' : initials}
              colorClass={isAnonymous ? 'from-gray-400 to-gray-500' : getAvatarColor(auth.currentUser?.uid || displayName)}
              size="md"
              src={isAnonymous ? undefined : getProfileIdentityImage(profile) || undefined}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{isAnonymous ? 'Anonymous' : displayName}</p>
              <p className="text-xs text-gray-400">
                {isAnonymous ? 'Your identity is hidden' : username && `@${username}`}
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
          </div>

          {category === 'notes' && (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subject</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_SUBJECTS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setNoteSubject(noteSubject === s.key ? '' : s.key)}
                      className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                        noteSubject === s.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Collection</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_COLLECTIONS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setNoteCollection(noteCollection === c.key ? '' : c.key)}
                      className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                        noteCollection === c.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {!noteCollection && (
                  <p className="mt-1.5 text-[11px] text-gray-400">Skip this and it'll be filed under General.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Chapter / Topic (optional)</p>
                <input
                  type="text"
                  value={noteChapter}
                  onChange={(e) => setNoteChapter(e.target.value)}
                  placeholder="e.g. Electrostatics"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all duration-300"
                />
              </div>
            </div>
          )}

          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              <Clock className="w-3.5 h-3.5" />
              Post lifetime
            </p>
            <p className="text-xs text-gray-400 mb-2">Choose how long this stays active on Campinity.</p>
            <div className="flex flex-wrap gap-2">
              {EXPIRATION_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={expirationType === key}
                  onClick={() => setExpirationType(key)}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                    expirationType === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400 transition-opacity duration-200">{expiryPreviewText}</p>
            {suggestedExpiration && suggestedExpiration !== expirationType && (
              <button
                type="button"
                onClick={() => setExpirationType(suggestedExpiration)}
                className="mt-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
              >
                Recommended for {categoryLabels[category]} · {EXPIRATION_OPTIONS.find((o) => o.key === suggestedExpiration)?.label}
              </button>
            )}
          </div>

          {!communitiesLoading && myCommunities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Post to</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPostTarget('public')}
                  className={`w-full flex items-center gap-3 text-left rounded-xl border px-4 py-3 transition-all duration-300 ${
                    postTarget === 'public' ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      postTarget === 'public' ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}
                  />
                  <span className={`text-sm font-medium ${postTarget === 'public' ? 'text-blue-600' : 'text-gray-700'}`}>
                    Public Feed
                  </span>
                </button>

                {myCommunities.map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    onClick={() => setPostTarget(community.id)}
                    className={`w-full flex items-center gap-3 text-left rounded-xl border px-4 py-3 transition-all duration-300 ${
                      postTarget === community.id ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                        postTarget === community.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium truncate ${
                        postTarget === community.id ? 'text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {community.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate('/home')}
              disabled={isPublishing}
              className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300 disabled:opacity-50"
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
