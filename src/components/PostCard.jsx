import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'
import {
  Bookmark,
  CalendarDays,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Heart,
  Layers,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PackageSearch,
  Share,
  ShoppingBag,
  Users
} from 'lucide-react'
import Avatar from './Avatar.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import ReportModal from './ReportModal.jsx'
import ShareBottomSheet from '../sharing/ShareBottomSheet.jsx'
import SaveBottomSheet from '../saved/SaveBottomSheet.jsx'
import { subscribeToIsItemSaved } from '../saved/savedService.js'
import { postTypeConfig } from '../data/dummyFeed.js'
import { auth } from '../firebase/firebase.js'
import { likePost, unlikePost, subscribeToPostShareCount, deletePost, editPost } from '../firebase/engagementService.js'

/**
 * 'general' and 'study' were added for Feature 4B (Create Post) — every
 * key in postTypeConfig must also have an icon here, or the badge below
 * throws trying to render an undefined component.
 */
const typeIcons = {
  general: Layers,
  study: GraduationCap,
  notes: FileText,
  event: CalendarDays,
  club: MessageCircle,
  marketplace: ShoppingBag,
  lostfound: PackageSearch
}

/**
 * No setInterval — computed once per render from a plain millisecond
 * timestamp, matching the explicit 'avoid expensive interval timers
 * per post' instruction. A page with 100 posts costs 100 cheap Date
 * subtractions, not 100 running timers.
 */
function formatExpiryBadge(expiresAtMs) {
  if (!expiresAtMs) return null
  const diffMs = expiresAtMs - Date.now()
  if (diffMs <= 0) return null // expired posts are filtered out of feeds already; this is a defensive fallback
  const minutes = Math.round(diffMs / 60000)
  const hours = Math.round(diffMs / 3600000)
  const days = Math.round(diffMs / 86400000)
  if (minutes < 60) return `Expires in ${minutes}m`
  if (hours < 24) return `Expires in ${hours}h`
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days}d`
}

export default function PostCard({ post, onDeleted = () => {}, canModerate = false }) {
  const expiryBadgeText = formatExpiryBadge(post.expiresAtMs)
  const verified = useMyVerification()
  const [verificationGateOpen, setVerificationGateOpen] = useState(false)
  const navigate = useNavigate()
  const config = postTypeConfig[post.type]
  const TypeIcon = typeIcons[post.type]

  const [liked, setLiked] = useState(post.likedByMe)
  const [likeCount, setLikeCount] = useState(post.likes)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    return subscribeToIsItemSaved(uid, 'post', post.id, setIsSaved)
  }, [post.id])
  const isOwner = auth.currentUser?.uid && post.userId === auth.currentUser.uid
  const [shareCount, setShareCount] = useState(post.shareCount || 0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [isDeleted, setIsDeleted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(post.text || '')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [currentText, setCurrentText] = useState(post.text || '')
  const [isEdited, setIsEdited] = useState(Boolean(post.edited))

  useEffect(() => {
    if (!isOwner) return undefined
    const unsubscribe = subscribeToPostShareCount(post.id, setShareCount)
    return unsubscribe
  }, [isOwner, post.id])

  const goToProfile = () => navigate(`/student/${post.username}`)
  const goToPost = () => navigate(`/post/${post.id}`)
  const goToCommunity = (event) => {
    event.stopPropagation()
    navigate(`/community/${post.communityId}`)
  }

  const handleSaveEdit = async () => {
    if (editSaving) return
    setEditSaving(true)
    setEditError('')
    try {
      await editPost(post.id, auth.currentUser?.uid, { text: editText })
      setCurrentText(editText.trim())
      setIsEdited(true)
      setIsEditing(false)
    } catch (err) {
      setEditError(err?.message || 'Could not save your changes. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeletePost = async () => {
    if (deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deletePost(post.id, auth.currentUser?.uid)
      setIsDeleted(true)
      onDeleted(post.id)
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete this post. Please try again.')
      setDeleting(false)
    }
  }

  const [justLiked, setJustLiked] = useState(false)

  const toggleLike = async () => {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((prev) => (nextLiked ? prev + 1 : prev - 1))
    if (nextLiked) {
      setJustLiked(true)
      window.setTimeout(() => setJustLiked(false), 300)
    }

    const uid = auth.currentUser?.uid
    if (!uid) return

    try {
      if (nextLiked) {
        await likePost(post.id, uid)
      } else {
        await unlikePost(post.id, uid)
      }
    } catch {
      // Roll back the optimistic update if the write failed.
      setLiked(!nextLiked)
      setLikeCount((prev) => (nextLiked ? prev - 1 : prev + 1))
    }
  }

  const handleShare = () => {
    setShareSheetOpen(true)
  }

  if (isDeleted) return null

  return (
    <>
    <article className="border-b border-gray-100 hover:bg-gray-50/40 lg:border-b-0 lg:border lg:border-white/50 lg:rounded-2xl lg:mb-4 lg:bg-white/32 lg:backdrop-blur-xl lg:shadow-[inset_1px_1px_0_rgba(255,255,255,0.55),0_4px_24px_rgba(91,77,255,0.08)] lg:hover:bg-white/45 lg:hover:shadow-[inset_1px_1px_0_rgba(255,255,255,0.65),0_10px_32px_rgba(91,77,255,0.13)] lg:hover:-translate-y-[1px] transition-all duration-300">
      {/* "Posted in X" — only when this post has a communityId (community
          posts now live in the same posts/ collection as everything
          else, distinguished only by this field). Deliberately placed
          ABOVE the author row, matching "Posted in Coding Club" appearing
          above the post per the brief, and stops click propagation so
          tapping the badge opens the community, not the post. */}
      {post.communityId && (
        <button
          type="button"
          onClick={goToCommunity}
          className="flex items-center gap-1.5 px-4 pt-3 text-[12px] font-medium text-blue-600 hover:text-blue-700 transition-all duration-300"
        >
          <Users className="w-3.5 h-3.5" />
          Posted in {post.communityName || 'a community'}
        </button>
      )}

      <div className={`flex items-start gap-3 px-4 ${post.communityId ? 'pt-2' : 'pt-4'}`}>
        <button type="button" onClick={goToProfile} aria-label={`Open ${post.name}'s profile`}>
          <Avatar initials={post.initials} colorClass={post.avatarColor} size="md" src={post.avatarUrl || undefined} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={goToProfile} className="min-w-0 text-left">
              <p className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                <span className="truncate min-w-0">{post.name}</span>
                <VerifiedBadge verified={post.verified} size="sm" />
              </p>
              <p className="text-xs text-gray-400 truncate">
                {post.department}
                {post.year && ` · ${post.year}`} · {post.college}
              </p>
            </button>
            <div className="relative flex-shrink-0">
                <button
                  type="button"
                  aria-label="Post options"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="text-gray-300 hover:text-gray-500 transition-all duration-300"
                >
                  <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-6 w-36 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setEditText(currentText)
                          setEditError('')
                          setIsEditing(true)
                        }}
                        className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150"
                      >
                        Edit post
                      </button>
                    )}
                    {(isOwner || canModerate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setConfirmingDelete(true)
                        }}
                        className="w-full text-left px-3.5 py-2 text-sm text-red-500 hover:bg-red-50 transition-all duration-150"
                      >
                        Delete post
                      </button>
                    )}
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setReportOpen(true)
                        }}
                        className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-150"
                      >
                        Report post
                      </button>
                    )}
                  </div>
                )}
              </div>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.color}`}
            >
              <TypeIcon className="w-3 h-3" />
              {config.label}
            </span>
            <span className="text-[11px] text-gray-400">{post.time}</span>
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="px-4 mt-3">
          <textarea
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[14.5px] text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
          />
          {editError && <p className="mt-1.5 text-xs text-red-500">{editError}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setEditText(currentText)
                setEditError('')
              }}
              disabled={editSaving}
              className="rounded-full border border-gray-200 text-gray-700 text-xs font-semibold px-4 py-1.5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={editSaving || !editText.trim()}
              className="rounded-full bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50"
            >
              {editSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={goToPost} className="block w-full text-left">
          <p className="px-4 mt-3 text-[14.5px] text-gray-700 leading-relaxed">
            {currentText}
            {isEdited && <span className="ml-1.5 text-xs text-gray-400 font-normal">· Edited</span>}
          </p>
          {post.imageUrl && <PostImage src={post.imageUrl} />}
        </button>
      )}

      {post.file && (
        <button
          type="button"
          onClick={() => {
            if (verified === false) {
              setVerificationGateOpen(true)
              return
            }
            if (post.file.url) {
              window.open(post.file.url, '_blank', 'noopener,noreferrer')
            } else {
              goToPost()
            }
          }}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 lg:border-white/50 lg:bg-white/35 lg:backdrop-blur-md p-3 w-[calc(100%-2rem)] text-left hover:border-blue-100 lg:hover:bg-white/50 transition-all duration-300"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{post.file.name}</p>
            <p className="text-xs text-gray-400">PDF{post.file.size ? ` · ${post.file.size}` : ''}</p>
            {verified === false && <p className="text-[11px] text-blue-600 font-medium mt-0.5">🔒 Verified members · Verify to open →</p>}
          </div>
          <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      )}

      <VerificationGate
        open={verificationGateOpen}
        onClose={() => setVerificationGateOpen(false)}
        feature={FEATURES.VIEW_CAMPUS_PDF}
      />

      {expiryBadgeText && (
        <p className="mx-4 mt-2 text-[11px] text-gray-400">⏳ {expiryBadgeText}</p>
      )}

      {post.type === 'event' && post.event && (
        <button
          type="button"
          onClick={goToPost}
          className="mx-4 mt-3 rounded-xl overflow-hidden border border-gray-100 w-[calc(100%-2rem)] text-left"
        >
          <div className="h-28 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <CalendarDays className="w-8 h-8 text-white/80" />
          </div>
          <div className="p-3 bg-white">
            <p className="text-sm font-semibold text-gray-900">{post.event.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {post.event.date}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {post.event.location}
              </span>
            </div>
          </div>
        </button>
      )}

      {post.type === 'marketplace' && post.marketplace && (
        <button
          type="button"
          onClick={goToPost}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-gray-100 p-3 w-[calc(100%-2rem)] text-left hover:border-blue-100 transition-all duration-300"
        >
          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{post.marketplace.item}</p>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">{post.marketplace.price}</p>
          </div>
        </button>
      )}

      {post.type === 'lostfound' && post.lostFound && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-pink-100 bg-pink-50/50 p-3">
          <PackageSearch className="w-5 h-5 text-pink-500 flex-shrink-0" />
          <p className="text-sm font-medium text-gray-900 min-w-0">
            {post.lostFound.status} near {post.lostFound.location}
          </p>
        </div>
      )}

      <div className="flex items-center gap-5 px-4 py-3 mt-1">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${
            liked ? 'text-red-500' : 'text-gray-500 hover:text-blue-600'
          }`}
        >
          <Heart
            className={`w-[18px] h-[18px] transition-transform duration-300 ${justLiked ? 'scale-125' : 'scale-100'}`}
            fill={liked ? 'currentColor' : 'none'}
          />
          {likeCount}
        </button>
        <button
          type="button"
          onClick={goToPost}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300"
        >
          <MessageCircle className="w-[18px] h-[18px]" />
          {post.comments}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300 ml-auto"
        >
          <Share className="w-[18px] h-[18px]" />
          Share
          {isOwner && shareCount > 0 && <span className="text-gray-400">· {shareCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setSaveSheetOpen(true)}
          aria-label={isSaved ? 'Saved' : 'Save'}
          aria-pressed={isSaved}
          className={`flex items-center transition-all duration-300 ${isSaved ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
        >
          <Bookmark className="w-[18px] h-[18px]" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <ShareBottomSheet
        open={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        referenceType="post"
        referenceId={post.id}
        preview={{
          title: post.text?.slice(0, 80) || 'Shared post',
          subtitle: post.name,
          username: post.username,
          image: post.imagePreviewUrl || null
        }}
      />

      <SaveBottomSheet
        open={saveSheetOpen}
        onClose={() => setSaveSheetOpen(false)}
        entityType="post"
        entityId={post.id}
        preview={{
          title: post.text?.slice(0, 80) || 'Saved post',
          subtitle: post.name,
          username: post.username,
          image: post.imagePreviewUrl || null
        }}
      />
    </article>

    {confirmingDelete &&
      createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => !deleting && setConfirmingDelete(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900">Delete post?</p>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
              This will permanently remove your post and its comments. This action cannot be undone.
            </p>
            {deleteError && <p className="mt-2 text-xs text-red-500">{deleteError}</p>}
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePost}
                disabled={deleting}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50 transition-all duration-300"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        targetOwnerUid={post.userId}
      />
    </>
  )
}

/**
 * Real fix for a confirmed, previously-missing feature: PostCard.jsx
 * never rendered an <img> tag at all, even though posts have carried
 * a real image field since post creation existed. Small, local, and
 * single-use — not extracted to its own file since it's only ever
 * used here. Loading skeleton and error fallback match the same
 * pattern already established in MessageBubble.jsx/StoryViewer.jsx.
 * max-h keeps a very tall or wide image from breaking the desktop
 * application-shell's scroll container (see HomePage.jsx's lg:h-screen
 * lg:overflow-y-auto center column) — an unbounded image here would
 * otherwise force that column taller than intended.
 */
function PostImage({ src }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  if (status === 'error') {
    return (
      <div className="mx-4 mt-3 rounded-2xl bg-gray-100 h-40 flex items-center justify-center">
        <span className="text-xs text-gray-400">Couldn't load image</span>
      </div>
    )
  }

  return (
    <div className="mx-4 mt-3 rounded-2xl overflow-hidden bg-gray-100 relative">
      {status === 'loading' && <div className="absolute inset-0 animate-pulse bg-gray-100" />}
      <img
        src={src}
        alt=""
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        className={`w-full max-h-[420px] lg:max-h-[520px] object-cover transition-opacity duration-300 ${
          status === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
