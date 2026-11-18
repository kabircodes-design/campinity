import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  ShoppingBag,
  Trash2,
  Users
} from 'lucide-react'
import ShareBottomSheet from '../sharing/ShareBottomSheet.jsx'
import SaveBottomSheet from '../saved/SaveBottomSheet.jsx'
import ReportModal from '../components/ReportModal.jsx'
import PostActionButton from '../components/post/PostActionButton.jsx'
import { subscribeToIsItemSaved } from '../saved/savedService.js'
import { getDisplayFileName } from '../utils/postFile.js'
import Avatar from '../components/Avatar.jsx'
import MentionText from '../components/MentionText.jsx'
import PostPoll from '../components/PostPoll.jsx'
import CommentCard from '../components/CommentCard.jsx'
import CommentComposer from '../components/CommentComposer.jsx'
import CommentSkeleton from '../components/CommentSkeleton.jsx'
import { auth } from '../firebase/firebase.js'
import { formatTimeAgo, getPostById } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getCommunityById } from '../firebase/communityService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { addComment, getComments, likePost, unlikePost, deletePost, editPost } from '../firebase/engagementService.js'
import { postTypeConfig } from '../data/dummyFeed.js'
import { useMyVerification } from '../access/useMyVerification.js'
import { useOpenDocument } from '../hooks/useOpenDocument.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'
import { useBackToClose } from '../navigation/overlayBackStack.js'

/**
 * Complete replacement of the old flat comment section — no
 * migrate-later, no side-by-side systems. Old local pieces removed
 * entirely: mapComment (the comments now come pre-shaped, ranked, and
 * threaded from getComments itself), toggleCommentLike (was
 * explicitly local-only/cosmetic — real, persisted, transactional
 * likeComment/unlikeComment now live in engagementService.js and are
 * called from inside CommentCard.jsx directly), handleDeleteComment
 * (same — moved into CommentCard.jsx, which now owns its own
 * edit/delete/pin/reply state instead of PostDetailPage.jsx managing
 * every comment's interactive state from above).
 *
 * getComments(postId) keeps its old two-argument call site
 * unchanged in spirit (still just needs postId) but now returns
 * { comments, nextCursor } (ranked, top-level only) instead of a flat
 * array — this page passes post.userId as creatorUid so the ranking
 * can apply the "creator interaction" boost correctly.
 *
 * #comment-{id} anchor + scroll-into-view + a brief highlight pulse:
 * this is the other half of NotificationCard.jsx's
 * /post/{id}#comment-{id} navigation — a reply/mention/pin
 * notification now actually lands ON the relevant comment, not just
 * on the post.
 */
function useScrollToCommentAnchor(commentsLoaded) {
  useEffect(() => {
    if (!commentsLoaded) return
    const hash = window.location.hash
    if (!hash.startsWith('#comment-')) return
    const el = document.getElementById(hash.slice(1))
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-blue-300', 'ring-offset-2', 'rounded-xl')
    const timer = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-blue-300', 'ring-offset-2', 'rounded-xl')
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [commentsLoaded])
}

export default function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const verified = useMyVerification()
  const [documentGateOpen, setDocumentGateOpen] = useState(false)
  const { openDocument, opening: openingDocument, error: documentError, clearError: clearDocumentError } = useOpenDocument()

  const [post, setPost] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [canModerate, setCanModerate] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  useBackToClose(menuOpen, () => setMenuOpen(false))
  useBackToClose(confirmingDelete, () => setConfirmingDelete(false))
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  // Share / Save / Report used to be local-only state ("Copied" without
  // copying, "Saved" without saving, "Reported" without reporting). They
  // now use the same real sheets/modal PostCard.jsx uses.
  const [isSaved, setIsSaved] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [imageStatus, setImageStatus] = useState('loading')

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid || !postId) return undefined
    return subscribeToIsItemSaved(uid, 'post', postId, setIsSaved)
  }, [postId])

  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')

  const isOwner = Boolean(post?.userId) && post.userId === auth.currentUser?.uid

  const handleSaveEdit = async () => {
    if (editSaving) return
    setEditSaving(true)
    setEditError('')
    try {
      await editPost(postId, auth.currentUser?.uid, { text: editText })
      setPost((prev) => ({ ...prev, text: editText.trim(), edited: true }))
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
      await deletePost(postId, auth.currentUser?.uid)
      navigate('/home')
    } catch (err) {
      setDeleteError(err?.message || 'Could not delete this post. Please try again.')
      setDeleting(false)
    }
  }

  useScrollToCommentAnchor(!commentsLoading)

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    const loadPost = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const data = await getPostById(postId, uid)
        if (cancelled) return
        if (!data) {
          setNotFound(true)
          setPost(null)
        } else {
          setPost(data)
          setLiked(data.likedByMe)
          setLikeCount(data.likes)

          if (data.communityId && uid) {
            try {
              const community = await getCommunityById(data.communityId)
              if (!cancelled && community) {
                setCanModerate(community.ownerId === uid || (community.admins || []).includes(uid))
              }
            } catch {
              // Community fetch failing shouldn't block viewing the
              // post itself — canModerate simply stays false, which
              // is the safe default (no extra delete capability
              // shown), not a crash.
            }
          }
        }
      } catch {
        if (!cancelled) {
          setNotFound(true)
          setPost(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const loadComments = async () => {
      setCommentsLoading(true)
      setCommentsError('')
      try {
        const { comments: data } = await getComments(postId, { creatorUid: post?.userId })
        if (!cancelled) setComments(data)
      } catch (err) {
        // This used to be a bare catch that silently left `comments`
        // empty — indistinguishable from a post that genuinely has zero
        // comments. That's exactly what hid a missing Firestore
        // composite index: the write path succeeded, this read failed
        // with FAILED_PRECONDITION, and nothing ever surfaced it.
        // console.error so it's visible in dev tools even before a user
        // reports anything, plus a real error state in the UI below
        // instead of a misleading empty-conversation message.
        console.error('Failed to load comments:', err)
        if (!cancelled) setCommentsError(err?.message || 'Could not load comments.')
      } finally {
        if (!cancelled) setCommentsLoading(false)
      }
    }

    const loadProfile = async () => {
      if (!uid) return
      try {
        const data = await getUserProfile(uid)
        if (!cancelled) setProfile(data)
      } catch {
        // Composer avatar/name just falls back to initials-only if this
        // fails; posting a comment still re-checks auth.currentUser.
      }
    }

    loadPost()
    loadComments()
    loadProfile()

    return () => {
      cancelled = true
    }
  }, [postId])

  const backButton = (
    <button
      type="button"
      aria-label="Back"
      onClick={() => navigate(-1)}
      className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all duration-200"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-white" aria-busy="true" aria-label="Loading post">
        <div className="h-14 flex items-center px-3">{backButton}</div>
        <div className="mx-auto max-w-[640px] px-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-3 w-24 rounded-full bg-gray-100 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-full rounded-full bg-gray-100 animate-pulse" />
            <div className="h-3.5 w-4/5 rounded-full bg-gray-100 animate-pulse" />
          </div>
          <div className="mt-4 aspect-[4/3] rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="h-14 flex items-center px-3">{backButton}</div>
        <div className="flex-1 flex items-center justify-center px-6 text-center pb-24">
          <div>
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <p className="mt-3 text-[15px] font-semibold text-gray-900">This post isn't available</p>
            <p className="mt-1 text-sm text-gray-500">It may have been deleted or expired.</p>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-200"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  const config = postTypeConfig[post.type] || postTypeConfig.general

  const toggleLike = async () => {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((prev) => (nextLiked ? prev + 1 : prev - 1))

    const uid = auth.currentUser?.uid
    if (!uid) return

    try {
      if (nextLiked) {
        await likePost(post.id, uid)
      } else {
        await unlikePost(post.id, uid)
      }
    } catch {
      setLiked(!nextLiked)
      setLikeCount((prev) => (nextLiked ? prev - 1 : prev + 1))
    }
  }

  const handleShare = () => setShareOpen(true)
  const postImage = post.imageUrl || post.imagePreviewUrl || null
  const sheetPreview = {
    title: post.text?.slice(0, 80) || 'Post',
    subtitle: post.name,
    username: post.username,
    image: postImage
  }
  const goToAuthor = () => {
    if (post.isAnonymous || !post.username) return
    navigate(isOwner ? '/profile' : `/student/${post.username}`)
  }

  const currentUser = profile
    ? { displayName: profile.displayName, username: profile.username, avatar: profile.avatar }
    : null

  const handlePostComment = async ({ text, mentionedUids }) => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    // Optimistic: insert immediately, replaced by the real ranked list
    // next time loadComments would run (this page doesn't currently
    // re-fetch after posting — the optimistic entry IS the persisted
    // state going forward this session, matching "optimistic updates"
    // without an extra round-trip read right after a write).
    const optimisticComment = {
      id: `optimistic-${Date.now()}`,
      userId: uid,
      displayName: currentUser?.displayName || 'Student',
      username: currentUser?.username || '',
      avatar: getProfileIdentityImage(currentUser) || '',
      text,
      mentions: mentionedUids,
      parentCommentId: null,
      replyCount: 0,
      likedBy: [],
      likesCount: 0,
      edited: false,
      pinned: false,
      createdAt: { toMillis: () => Date.now() }
    }
    setComments((prev) => [optimisticComment, ...prev])

    try {
      const realId = await addComment(postId, {
        uid,
        displayName: currentUser?.displayName,
        username: currentUser?.username,
        avatar: getProfileIdentityImage(currentUser) || '',
        text,
        mentionedUids
      })
      setComments((prev) => prev.map((c) => (c.id === optimisticComment.id ? { ...c, id: realId } : c)))
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id))
    }
  }

  return (
    <div className="h-screen lg:h-full flex flex-col overflow-hidden bg-white lg:bg-gray-50">
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="h-14 flex items-center gap-1 px-3 lg:max-w-[640px] lg:mx-auto">
          {backButton}
          <span className="flex-1 text-[17px] font-bold tracking-tight text-gray-900">Post</span>
          {isOwner && (
            <div className="relative">
              <button
                type="button"
                aria-label="Post options"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-200"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <button type="button" aria-label="Close menu" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-11 w-44 rounded-2xl border border-gray-100 bg-white shadow-lg py-1.5 z-30">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setEditText(post.text || '')
                        setEditError('')
                        setIsEditing(true)
                      }}
                      className="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="w-4 h-4" /> Edit post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false)
                        setConfirmingDelete(true)
                      }}
                      className="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete post
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[640px] bg-white lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] min-h-full lg:min-h-0">
          <main>
            {post.communityId && post.communityName && (
              <button
                type="button"
                onClick={() => navigate(`/community/${post.communityId}`)}
                className="mx-4 mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold px-3 py-1"
              >
                <Users className="w-3.5 h-3.5" /> Posted in {post.communityName}
              </button>
            )}

            {/* Author */}
            <div className="flex items-center gap-3 px-4 pt-4">
              <button type="button" onClick={goToAuthor} className="flex-shrink-0 rounded-full" aria-label={`Open ${post.name}'s profile`} disabled={post.isAnonymous || !post.username}>
                <Avatar initials={post.initials} colorClass={post.avatarColor} size="md" src={post.avatarUrl || undefined} />
              </button>
              <div className="flex-1 min-w-0">
                <button type="button" onClick={goToAuthor} disabled={post.isAnonymous || !post.username} className="max-w-full text-left">
                  <span className="block text-[15px] font-bold text-gray-900 truncate leading-tight">{post.name}</span>
                </button>
                <p className="mt-0.5 text-xs text-gray-500 truncate">
                  {[post.username && !post.isAnonymous ? `@${post.username}` : null, post.time].filter(Boolean).join(' · ')}
                  {post.edited && ' · Edited'}
                </p>
              </div>
              {config.label && config !== postTypeConfig.general && (
                <span className={`flex-shrink-0 inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full ${config.color}`}>
                  {config.label}
                </span>
              )}
            </div>

            {/* Text */}
            {isEditing ? (
              <div className="px-4 mt-3">
                <textarea
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  rows={4}
                  autoFocus
                  aria-label="Edit post text"
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-[15px] text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
                />
                {editError && <p className="mt-1.5 text-xs text-red-500">{editError}</p>}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false)
                      setEditError('')
                    }}
                    disabled={editSaving}
                    className="rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={editSaving || !editText.trim()}
                    className="rounded-full bg-blue-600 text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              post.text && (
                <p className={`px-4 mt-3 text-gray-900 leading-relaxed whitespace-pre-wrap break-words ${postImage || post.text.length > 180 ? 'text-[15px]' : 'text-[17px]'}`}>
                  <MentionText text={post.text} />
                </p>
              )
            )}

            {/* Image — shown whole (object-contain on a neutral backdrop)
                so a tall or wide photo is never cropped. */}
            {postImage && (
              <div className="mt-3 lg:mx-4 lg:rounded-2xl overflow-hidden bg-gray-100 relative">
                {imageStatus === 'error' ? (
                  <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-1.5">
                    <FileText className="w-6 h-6" />
                    <span className="text-xs">Couldn't load this image</span>
                    <button type="button" onClick={() => setImageStatus('loading')} className="text-xs font-semibold text-blue-600">
                      Try again
                    </button>
                  </div>
                ) : (
                  <>
                    {imageStatus === 'loading' && <div className="absolute inset-0 animate-pulse bg-gray-100" aria-hidden="true" />}
                    <img
                      key={imageStatus === 'loading' ? 'retry' : 'img'}
                      src={postImage}
                      alt={post.text ? `Photo: ${post.text.slice(0, 80)}` : 'Post photo'}
                      onLoad={() => setImageStatus('ready')}
                      onError={() => setImageStatus('error')}
                      onDoubleClick={() => !liked && toggleLike()}
                      className={`w-full max-h-[75vh] min-h-[180px] object-contain transition-opacity duration-300 ${imageStatus === 'ready' ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </>
                )}
              </div>
            )}

            {post.poll && <PostPoll postId={post.id} poll={post.poll} />}

            {post.file && (
              <>
                <button
                  type="button"
                  disabled={openingDocument}
                  onClick={() => {
                    // UX-level pre-check only — the real authorization
                    // boundary is storage.rules, enforced inside
                    // useOpenDocument's getDownloadURL().
                    if (verified === false && !isOwner) {
                      setDocumentGateOpen(true)
                      return
                    }
                    clearDocumentError()
                    openDocument(post)
                  }}
                  className="mx-4 mt-3 w-[calc(100%-2rem)] flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left hover:border-blue-100 disabled:opacity-60 transition-all duration-200"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{getDisplayFileName(post.file)}</p>
                    <p className="text-xs text-gray-500">{openingDocument ? 'Opening…' : `PDF${post.file.size ? ` · ${post.file.size}` : ''}`}</p>
                    {verified === false && !isOwner && (
                      <p className="text-[11px] text-blue-600 font-medium mt-0.5">🔒 Verified members · Verify to open →</p>
                    )}
                  </div>
                </button>
                {documentError && (
                  <p role="alert" className="mx-4 mt-1.5 text-xs text-red-500">
                    {documentError}
                  </p>
                )}
              </>
            )}

            <VerificationGate open={documentGateOpen} onClose={() => setDocumentGateOpen(false)} feature={FEATURES.VIEW_CAMPUS_PDF} />

            {post.event && (
              <div className="mx-4 mt-3 rounded-2xl overflow-hidden border border-gray-100">
                <div className="h-28 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <CalendarDays className="w-8 h-8 text-white/80" />
                </div>
                <div className="p-3 bg-white">
                  <p className="text-sm font-semibold text-gray-900">{post.event.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
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
              </div>
            )}

            {post.marketplace && (
              <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-gray-100 p-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-6 h-6 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{post.marketplace.item}</p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">{post.marketplace.price}</p>
                </div>
              </div>
            )}

            {post.lostFound && (
              <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50/50 p-3">
                <PackageSearch className="w-5 h-5 text-pink-500 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-900 min-w-0">
                  {post.lostFound.status} near {post.lostFound.location}
                </p>
              </div>
            )}

            {/* Counts + actions */}
            <div className="px-4 pt-3 flex items-center gap-3 text-xs text-gray-500">
              <span>
                <span className="font-semibold text-gray-900">{likeCount}</span> {likeCount === 1 ? 'like' : 'likes'}
              </span>
              <span>
                <span className="font-semibold text-gray-900">{comments.length}</span> {comments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>
            <div className="mt-2 mx-2 flex items-center border-y border-gray-100 py-1">
              <PostActionButton action="like" active={liked} label="Like" ariaLabel={liked ? 'Unlike' : 'Like'} onClick={toggleLike} className="flex-1 h-11" />
              <PostActionButton
                action="comment"
                label="Comment"
                onClick={() => document.getElementById('post-comment-composer')?.querySelector('textarea, input')?.focus()}
                className="flex-1 h-11"
              />
              <PostActionButton action="share" label="Share" onClick={handleShare} className="flex-1 h-11" />
              <PostActionButton action="save" active={isSaved} showLabel={false} label={isSaved ? 'Saved' : 'Save'} onClick={() => setSaveOpen(true)} className="w-11 h-11" />
              {!isOwner && (
                <PostActionButton action="report" showLabel={false} label="Report post" onClick={() => setReportOpen(true)} className="w-11 h-11" />
              )}
            </div>

            {/* Comments */}
            <section className="px-4 pt-4 pb-6" aria-label="Comments">
              <h2 className="text-[15px] font-bold text-gray-900 mb-2">Comments</h2>

              {commentsLoading ? (
                <CommentSkeleton />
              ) : commentsError ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-gray-900">Couldn't load comments</p>
                  <p className="mt-1 text-xs text-gray-500">{commentsError}</p>
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">No comments yet</p>
                  <p className="mt-0.5 text-xs text-gray-500">Start the conversation.</p>
                </div>
              ) : (
                <div>
                  {comments.map((comment) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      postId={postId}
                      postOwnerUid={post.userId}
                      currentUid={auth.currentUser?.uid}
                      currentUser={currentUser}
                      canModerate={canModerate}
                      onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>

      <div
        id="post-comment-composer"
        className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-3 pt-2.5 lg:px-0"
        style={{ paddingBottom: 'calc(0.625rem + var(--app-safe-bottom, env(safe-area-inset-bottom)))' }}
      >
        <div className="lg:max-w-[640px] lg:mx-auto">
          <CommentComposer currentUser={currentUser} onSubmit={handlePostComment} />
        </div>
      </div>

      <ShareBottomSheet open={shareOpen} onClose={() => setShareOpen(false)} referenceType="post" referenceId={post.id} preview={sheetPreview} />
      <SaveBottomSheet open={saveOpen} onClose={() => setSaveOpen(false)} entityType="post" entityId={post.id} preview={sheetPreview} />
      {!isOwner && (
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="post" targetId={post.id} targetOwnerUid={post.userId} />
      )}

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
                  className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deleting}
                  className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50 transition-all duration-200"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
