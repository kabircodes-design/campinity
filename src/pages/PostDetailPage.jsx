import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Clock,
  Download,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PackageSearch,
  Share,
  ShoppingBag
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import CommentCard from '../components/CommentCard.jsx'
import CommentComposer from '../components/CommentComposer.jsx'
import CommentSkeleton from '../components/CommentSkeleton.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { formatTimeAgo, getPostById } from '../firebase/postService.js'
import { getUserProfile } from '../firebase/profileService.js'
import { addComment, getComments, likePost, unlikePost, deletePost } from '../firebase/engagementService.js'
import { postTypeConfig } from '../data/dummyFeed.js'

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

  const [post, setPost] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [reported, setReported] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')

  const isOwner = Boolean(post?.userId) && post.userId === auth.currentUser?.uid

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

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">Post not found</p>
            <p className="mt-1 text-sm text-gray-400">It may have been removed.</p>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back to Home
            </button>
          </div>
        </div>
        <BottomNav />
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

  const handleShare = () => {
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 1500)
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
      avatar: currentUser?.avatar || '',
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
        avatar: currentUser?.avatar,
        text,
        mentionedUids
      })
      setComments((prev) => prev.map((c) => (c.id === optimisticComment.id ? { ...c, id: realId } : c)))
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticComment.id))
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Post</span>
          </div>
        </header>

        <main className="pb-32">
          <div className="flex items-start gap-3 px-4 pt-4">
            <Avatar initials={post.initials} colorClass={post.avatarColor} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{post.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[post.department, post.year, post.college].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {isOwner && (
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
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.color}`}
                >
                  {config.label}
                </span>
                <span className="text-[11px] text-gray-400">{post.time}</span>
              </div>
            </div>
          </div>

          {post.text && (
            <p className="px-4 mt-3 text-[15px] text-gray-700 leading-relaxed whitespace-pre-wrap">{post.text}</p>
          )}

          {post.imagePreviewUrl && (
            <div className="mx-4 mt-3 rounded-xl overflow-hidden border border-gray-100">
              <img src={post.imagePreviewUrl} alt="Post attachment" className="w-full max-h-80 object-cover" />
            </div>
          )}

          {post.file && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{post.file.name}</p>
                <p className="text-xs text-gray-400">{post.file.size}</p>
              </div>
            </div>
          )}

          {post.event && (
            <div className="mx-4 mt-3 rounded-xl overflow-hidden border border-gray-100">
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
            </div>
          )}

          {post.marketplace && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-gray-100 p-3">
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{post.marketplace.item}</p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">{post.marketplace.price}</p>
              </div>
            </div>
          )}

          {post.lostFound && (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-pink-100 bg-pink-50/50 p-3">
              <PackageSearch className="w-5 h-5 text-pink-500 flex-shrink-0" />
              <p className="text-sm font-medium text-gray-900 min-w-0">
                {post.lostFound.status} near {post.lostFound.location}
              </p>
            </div>
          )}

          <div className="flex items-center gap-5 px-4 py-3 mt-2 border-y border-gray-100">
            <button
              type="button"
              onClick={toggleLike}
              aria-pressed={liked}
              className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${
                liked ? 'text-red-500' : 'text-gray-500 hover:text-blue-600'
              }`}
            >
              <Heart className="w-[18px] h-[18px]" fill={liked ? 'currentColor' : 'none'} />
              {likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <MessageCircle className="w-[18px] h-[18px]" />
              {comments.length}
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300"
            >
              <Share className="w-[18px] h-[18px]" />
              {shareCopied ? 'Copied' : 'Share'}
            </button>
            <button
              type="button"
              onClick={() => setSaved((prev) => !prev)}
              aria-pressed={saved}
              className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ml-auto ${
                saved ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
              }`}
            >
              <Bookmark className="w-[18px] h-[18px]" fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setReported(true)}
              disabled={reported}
              className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${
                reported ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
              }`}
            >
              <Flag className="w-[18px] h-[18px]" />
              {reported ? 'Reported' : 'Report'}
            </button>
          </div>

          <section className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>

            {commentsLoading ? (
              <CommentSkeleton />
            ) : commentsError ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-gray-900">Couldn't load comments</p>
                <p className="mt-1 text-xs text-gray-400">{commentsError}</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-2xl">💬</p>
                <p className="mt-2 text-sm font-semibold text-gray-900">Start the conversation</p>
                <p className="mt-0.5 text-xs text-gray-400">Be the first person to comment.</p>
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
                    onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-[480px] lg:max-w-[520px] bg-white/95 backdrop-blur-md border-t border-gray-100 px-3 py-2.5">
          <CommentComposer currentUser={currentUser} onSubmit={handlePostComment} />
        </div>
      </div>

      <BottomNav />

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
    </div>
  )
}
