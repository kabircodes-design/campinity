import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Clock, FileText, Image as ImageIcon, Plus, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Switch from '../components/Switch.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { computeExpiresAt, createPost, getAvatarColor, getInitials, uploadPostDocument, uploadPostImage } from '../firebase/postService.js'
import { getUserCommunityMemberships, getCommunityById, getCommunityChannels } from '../firebase/communityService.js'
import { createMentionNotification } from '../firebase/notificationService.js'
import { useMentionAutocomplete } from '../hooks/useMentionAutocomplete.js'
import MentionSuggestions from '../components/MentionSuggestions.jsx'
import { savePostDraft, getPostDraft, clearPostDraft } from '../utils/postDraft.js'
import { extractHashtags } from '../utils/hashtags.js'
import { moderateText } from '../moderation/profanityFilter.js'
import { usePostingStatus } from '../context/PostingStatusContext.jsx'
import { awardXP, getUserProgress } from '../gamification/xpService.js'
import { checkAndAwardBadges } from '../gamification/badgeService.js'
import { POINTS_REWARDS } from '../gamification/config.js'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

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

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CreatePostPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedCommunityId = location.state?.communityId || null
  const preselectedChannelId = location.state?.channelId || null
  const verified = useMyVerification()
  const { startPosting, markSuccess, markError } = usePostingStatus()
  const imageInputRef = useRef(null)
  const pdfInputRef = useRef(null)

  const [profile, setProfile] = useState(null)

  const [postText, setPostText] = useState('')
  const postTextareaRef = useRef(null)
  const { mentionedUids, mentionQuery, mentionResults, mentionActiveIndex, detectMentionTrigger, selectMention, handleMentionKeyDown } =
    useMentionAutocomplete(postText, setPostText, postTextareaRef)
  const [pendingDraft, setPendingDraft] = useState(null)
  const [pollEnabled, setPollEnabled] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
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
  const [channels, setChannels] = useState([])
  const [selectedChannelId, setSelectedChannelId] = useState(preselectedChannelId || 'general')

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

  // Offers a restore, never auto-applies — silently overwriting whatever
  // the user is about to type with an old draft would be worse than not
  // having one. Only offered once, on mount, while the composer is
  // still genuinely empty.
  useEffect(() => {
    if (postText.trim()) return
    const draft = getPostDraft()
    if (draft) setPendingDraft(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced local-only autosave — text plus the couple of simple
  // fields needed to restore the same composer state; never the
  // image/PDF File objects (can't survive localStorage, and re-picking
  // a file is a one-tap action anyway). Skips entirely while a restore
  // offer is still on screen, so it can't overwrite the very draft it's
  // about to offer before the user has chosen to keep or discard it.
  useEffect(() => {
    if (pendingDraft) return undefined
    const timer = window.setTimeout(() => {
      savePostDraft({ text: postText, category, isAnonymous })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [postText, category, isAnonymous, pendingDraft])

  const handleRestoreDraft = () => {
    if (!pendingDraft) return
    setPostText(pendingDraft.text || '')
    if (pendingDraft.category) setCategory(pendingDraft.category)
    if (typeof pendingDraft.isAnonymous === 'boolean') setIsAnonymous(pendingDraft.isAnonymous)
    setPendingDraft(null)
  }

  const handleDiscardDraft = () => {
    clearPostDraft()
    setPendingDraft(null)
  }

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
        const validCommunities = communities.filter(Boolean)
        if (!cancelled) {
          setMyCommunities(validCommunities)
          // Deep-linked from a community page's composer ("Post to this
          // community") — only trusted if the membership fetch above
          // actually confirms the user belongs to it, never taken as-is
          // from navigation state alone.
          if (preselectedCommunityId && validCommunities.some((c) => c.id === preselectedCommunityId)) {
            setPostTarget(preselectedCommunityId)
          }
        }
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

  // Real per-community channels (communities/{id}/channels), fetched
  // once a real community target is picked — never fetched for the
  // public-feed target, which has no channels at all.
  useEffect(() => {
    if (postTarget === 'public') {
      setChannels([])
      return undefined
    }
    let cancelled = false
    getCommunityChannels(postTarget)
      .then((data) => {
        if (cancelled) return
        setChannels(data)
        if (data.length > 0 && !data.some((c) => c.id === selectedChannelId)) {
          setSelectedChannelId(data.find((c) => c.id === 'general')?.id || data[0].id)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postTarget])

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

  const updatePollOption = (index, value) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  const addPollOption = () => {
    setPollOptions((prev) => (prev.length >= 6 ? prev : [...prev, '']))
  }

  const removePollOption = (index) => {
    setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  const removePoll = () => {
    setPollEnabled(false)
    setPollQuestion('')
    setPollOptions(['', ''])
  }

  const trimmedPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean)
  const pollIsValid = !pollEnabled || (pollQuestion.trim().length > 0 && trimmedPollOptions.length >= 2)

  const hasContent = postText.trim().length > 0 || Boolean(imageFile) || Boolean(pdfFile) || pollEnabled
  const isValid = hasContent && pollIsValid

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

    // Moderation runs synchronously, before navigation — the brief is
    // explicit that moderation must never be bypassed for speed. This
    // is fast (pure JS, no network), so it doesn't meaningfully delay
    // the "instant Home" feel; it just has to happen before the
    // content is considered postable at all.
    const moderationResult = moderateText(postText.trim())

    // Snapshot everything handlePublish's background continuation
    // needs — this component is about to unmount via navigate(),
    // so nothing after this point can read component state/props
    // again; it can only close over these already-captured values.
    const publishData = {
      uid,
      text: moderationResult.text,
      imageFile,
      pdfFile,
      isAnonymous,
      displayName,
      username,
      avatar: profile?.avatar || '',
      collegeId: profile?.collegeId || null,
      category,
      expirationType,
      noteSubject,
      noteCollection,
      noteChapter,
      selectedCommunity: postTarget !== 'public' ? myCommunities.find((c) => c.id === postTarget) : null,
      selectedChannel: postTarget !== 'public' && channels.length > 0 ? channels.find((c) => c.id === selectedChannelId) : null,
      mentionedUids: mentionedUids.filter((mentionedUid) => mentionedUid !== uid), // never notify yourself for @-ing your own username
      poll: pollEnabled
        ? {
            question: pollQuestion.trim(),
            options: trimmedPollOptions.slice(0, 6).map((text, i) => ({ id: `opt-${i}`, text }))
          }
        : null
    }

    clearPostDraft()
    startPosting(imageFile ? 'Posting your photo…' : 'Posting…')
    // A community post lands the user back in that community's own feed
    // (its own posts/{postId} listener picks up the new post the normal
    // way once written) — not Home, which now deliberately excludes
    // community posts entirely (see postFeedShared.js/getFeedPosts).
    const targetCommunity = postTarget !== 'public' ? myCommunities.find((c) => c.id === postTarget) : null
    navigate(targetCommunity ? `/community/${targetCommunity.id}` : '/home')

    // Everything below now runs in the background, after the user is
    // already on Home. This function keeps running even though
    // CreatePostPage has unmounted — it's a plain async function, not
    // tied to component lifecycle, and only touches the global
    // context's setters (markSuccess/markError) from here on, never
    // this component's own setState.
    try {
      let imageUrl = null
      if (publishData.imageFile) {
        imageUrl = await uploadPostImage(publishData.uid, publishData.imageFile)
      }

      let fileData = null
      if (publishData.pdfFile) {
        // Storage PATH only — never a usable URL. See
        // uploadPostDocument's own comment in postService.js for why:
        // a getDownloadURL() result is a permanent bearer token, so
        // storing it here would have been the same bypass this whole
        // pass exists to close. getVerifiedPostDocumentUrl (Cloud
        // Function) resolves this path into a real, short-lived URL
        // on demand, only for verified users.
        const filePath = await uploadPostDocument(publishData.uid, publishData.pdfFile)
        fileData = {
          name: publishData.pdfFile.name,
          size: formatFileSize(publishData.pdfFile.size),
          path: filePath,
          mimeType: 'application/pdf'
        }
      }

      const author = publishData.isAnonymous
        ? { displayName: 'Anonymous', username: 'anonymous', profilePhoto: '' }
        : { displayName: publishData.displayName, username: publishData.username, profilePhoto: publishData.avatar }

      const newPostId = await createPost({
        uid: publishData.uid,
        text: publishData.text,
        imageUrl,
        author,
        extra: {
          category: publishData.category,
          // Campus-feed scoping pass — best-effort only, going forward:
          // posts created before this field existed simply don't have
          // it, matching this exact file's own established, already-
          // documented pattern for textLower (searchPostsByText's
          // comment above states the same honest limitation for
          // pre-existing posts). No backfill migration attempted.
          collegeId: publishData.collegeId,
          mentions: publishData.mentionedUids,
          hashtags: extractHashtags(publishData.text),
          ...(publishData.poll && { poll: publishData.poll }),
          isAnonymous: publishData.isAnonymous,
          expirationType: publishData.expirationType,
          expiresAt: computeExpiresAt(publishData.expirationType),
          ...(publishData.category === 'notes' && {
            subject: publishData.noteSubject || 'unassigned',
            collection: publishData.noteCollection || 'general',
            ...(publishData.noteChapter.trim() && { chapter: publishData.noteChapter.trim() })
          }),
          ...(fileData && { file: fileData }),
          ...(publishData.selectedCommunity && {
            communityId: publishData.selectedCommunity.id,
            communityName: publishData.selectedCommunity.name
          }),
          // channelId → communityId → post: only ever set alongside a
          // real communityId, and only when that community actually has
          // channel docs (an older community with none simply never gets
          // this field — its whole feed stays one unified stream, exactly
          // as before channels existed).
          ...(publishData.selectedCommunity &&
            publishData.selectedChannel && {
              channelId: publishData.selectedChannel.id,
              channelName: publishData.selectedChannel.name
            })
        }
      })

      // Reuses the exact same createMentionNotification comments already
      // rely on — NotificationCard.jsx's click handler already falls
      // back to navigate(`/post/${postId}`) when there's no commentId
      // (nothing needed there), so a post-level mention deep-links
      // correctly with zero changes to notification routing. Never the
      // real name/avatar for an anonymous post — the whole point of
      // isAnonymous is that identity stays hidden, including from
      // someone who gets mentioned in it.
      if (publishData.mentionedUids.length > 0) {
        Promise.all(
          publishData.mentionedUids.map((mentionedUid) =>
            createMentionNotification({
              targetUid: mentionedUid,
              actorUid: publishData.uid,
              actorName: publishData.isAnonymous ? 'Someone' : publishData.displayName,
              actorAvatar: publishData.isAnonymous ? '' : publishData.avatar,
              postId: newPostId,
              commentId: null,
              commentText: publishData.text
            }).catch(() => {})
          )
        )
      }

      const postAward = await awardXP(publishData.uid, 'post_created', {
        campusPoints: POINTS_REWARDS.post_created || 0,
        dedupeKey: `post_created_${newPostId}`
      }).catch(() => null)
      if (postAward) {
        const progress = await getUserProgress(publishData.uid).catch(() => null)
        if (progress) await checkAndAwardBadges(publishData.uid, progress).catch(() => {})
      }

      // Real post object for optimistic feed insertion — matches the
      // real shape createPost/getFeedPosts produce (id + the fields
      // PostCard actually reads), not a fabricated placeholder. Home
      // is responsible for deduplicating this against whatever its
      // own Firestore-backed load eventually returns for the same id.
      markSuccess(
        {
          id: newPostId,
          text: publishData.text,
          imageUrl,
          userId: publishData.uid,
          name: author.displayName,
          username: author.username,
          avatarUrl: author.profilePhoto,
          type: publishData.category,
          time: 'now',
          likes: 0,
          likedByMe: false,
          comments: 0,
          feedCategories: ['forYou', 'campus'],
          // ROOT CAUSE of "poll doesn't appear in the feed until
          // opening the post" — this hand-built object is what
          // HomePage.jsx inserts into its `posts` state immediately
          // after a successful createPost(), for instant feed display
          // without waiting on a real refetch. It's a SEPARATE object
          // from what Firestore actually stores (createPost's own
          // `extra` above already correctly writes `poll`) — this one
          // just never included it, so PostCard's `{post.poll && ...}`
          // check was always false for the optimistic copy specifically.
          // PostDetailPage never showed this bug because it always does
          // a real getPostById() -> mapPostDoc() fetch, which already
          // mapped `poll` correctly (confirmed by reading it) — the gap
          // was only ever in this one optimistic-insertion object, nothing
          // about feed mapping/normalization/PostCard's own render logic
          // was actually broken.
          poll: publishData.poll,
          ...(fileData && { file: fileData }),
          ...(publishData.selectedCommunity && {
            communityId: publishData.selectedCommunity.id,
            communityName: publishData.selectedCommunity.name
          }),
          ...(publishData.selectedCommunity &&
            publishData.selectedChannel && {
              channelId: publishData.selectedChannel.id,
              channelName: publishData.selectedChannel.name
            })
        },
        'Posted'
      )
    } catch (err) {
      markError(err?.message || "Couldn't post. Try again.")
    }
  }

  // Defense in depth against direct navigation to /create — the actual
  // security boundary is Firestore's own posts/{postId} create rule
  // (see firestore.rules), not this check; this just replaces a
  // confusing "why did my post silently fail" experience with the same
  // gate PostComposer.jsx already shows before ever letting someone
  // reach this page in the normal flow.
  if (verified === false) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
            <div className="h-14 flex items-center px-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate('/home')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>
          <VerificationGate open onClose={() => navigate('/home')} feature={FEATURES.CREATE_POST} />
        </div>
      </div>
    )
  }

  // When arriving from a community's own "Share something..." prompt
  // (CommunityDetailPage's composer entry, via navigate('/create',
  // { state: { communityId } })), the target is already known — the
  // generic "Post to" selector below is hidden entirely and postTarget
  // stays locked to it, so the user is never asked to reselect a
  // community they already chose by entering it in the first place.
  const lockedCommunity = preselectedCommunityId
    ? myCommunities.find((c) => c.id === preselectedCommunityId) || null
    : null

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-3">
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => navigate(lockedCommunity ? `/community/${lockedCommunity.id}` : '/home')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">
              {lockedCommunity ? 'New Community Post' : 'New Post'}
            </span>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!isValid || isPublishing}
              className="rounded-full bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </header>

        <div className="px-4 py-4 pb-24 space-y-5">
          {lockedCommunity && (
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {lockedCommunity.icon ? (
                  <img src={lockedCommunity.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-xs font-bold">{lockedCommunity.name?.[0]?.toUpperCase() || 'C'}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-blue-500 uppercase tracking-wide">Posting in</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{lockedCommunity.name}</p>
              </div>
            </div>
          )}

          {lockedCommunity && channels.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scroll-hidden">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`flex-shrink-0 rounded-full text-xs font-semibold px-3 py-1.5 transition-all duration-200 ${
                    selectedChannelId === channel.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  #{channel.name}
                </button>
              ))}
            </div>
          )}

          {pendingDraft && (
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 [animation:fadeIn_150ms_ease-out]">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-blue-900">Restore your draft?</p>
                <p className="text-[11.5px] text-blue-700 truncate">{pendingDraft.text}</p>
              </div>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="flex-shrink-0 rounded-full border border-blue-200 text-blue-700 text-[11px] font-semibold px-3 py-1.5 hover:bg-blue-100 transition-all duration-200"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="flex-shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-semibold px-3 py-1.5 hover:bg-blue-700 transition-all duration-200"
              >
                Restore
              </button>
            </div>
          )}

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

          <div className="relative">
            <textarea
              ref={postTextareaRef}
              autoFocus
              rows={5}
              maxLength={MAX_LENGTH}
              value={postText}
              onChange={(event) => {
                setPostText(event.target.value)
                setError('')
                detectMentionTrigger(event.target.value, event.target.selectionStart)
              }}
              onKeyDown={(event) => {
                handleMentionKeyDown(event)
              }}
              placeholder={
                lockedCommunity
                  ? channels.length > 0
                    ? `Share something in #${channels.find((c) => c.id === selectedChannelId)?.name?.toLowerCase() || 'general'}...`
                    : `Share something with ${lockedCommunity.name}...`
                  : "What's happening on campus? Use @ to mention someone."
              }
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {postText.length}/{MAX_LENGTH}
            </p>
            {mentionQuery !== null && (
              <MentionSuggestions
                results={mentionResults}
                activeIndex={mentionActiveIndex}
                onSelect={selectMention}
                className="absolute top-full left-0 w-64 -mt-4"
              />
            )}
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

            {pollEnabled ? (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 space-y-2.5 [animation:fadeIn_150ms_ease-out]">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <BarChart3 className="w-3.5 h-3.5" /> Poll
                  </p>
                  <button type="button" onClick={removePoll} aria-label="Remove poll" className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(event) => setPollQuestion(event.target.value)}
                  maxLength={140}
                  placeholder="Ask a question..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 transition-all duration-200"
                />
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(event) => updatePollOption(index, event.target.value)}
                      maxLength={60}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 transition-all duration-200"
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => removePollOption(index)} aria-label="Remove option" className="text-gray-300 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button type="button" onClick={addPollOption} className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                    <Plus className="w-3.5 h-3.5" /> Add option
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPollEnabled(true)}
                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-gray-200 px-4 py-3.5 hover:border-blue-200 hover:bg-blue-50/40 transition-all duration-300"
              >
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">Add a poll</span>
              </button>
            )}
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

          {!communitiesLoading && !lockedCommunity && myCommunities.length > 0 && (
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
              className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
