import { useRef, useState } from 'react'
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
  Send,
  Share,
  ShoppingBag
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { usePosts } from '../hooks/usePosts.jsx'
import { postTypeConfig } from '../data/dummyFeed.js'
import { currentUserProfile } from '../data/dummyProfile.js'
import { dummyCommentsByPostId } from '../data/dummyComments.js'

export default function PostDetailPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const { getPostById } = usePosts()
  const commentInputRef = useRef(null)

  const post = getPostById(postId)

  const [liked, setLiked] = useState(post?.likedByMe ?? false)
  const [likeCount, setLikeCount] = useState(post?.likes ?? 0)
  const [saved, setSaved] = useState(false)
  const [reported, setReported] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [comments, setComments] = useState(() => dummyCommentsByPostId[post?.id] || [])
  const [commentText, setCommentText] = useState('')

  if (!post) {
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

  const toggleLike = () => {
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
  }

  const handleShare = () => {
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 1500)
  }

  const focusComposer = (prefill = '') => {
    if (prefill) setCommentText(prefill)
    commentInputRef.current?.focus()
  }

  const toggleCommentLike = (commentId) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              likedByMe: !comment.likedByMe,
              likes: comment.likedByMe ? comment.likes - 1 : comment.likes + 1
            }
          : comment
      )
    )
  }

  const handleSendComment = (event) => {
    event.preventDefault()
    const trimmed = commentText.trim()
    if (!trimmed) return

    const newComment = {
      id: `local-comment-${Date.now()}`,
      author: currentUserProfile.name,
      initials: currentUserProfile.initials,
      colorClass: currentUserProfile.colorClass,
      text: trimmed,
      time: 'Just now',
      likes: 0,
      likedByMe: false
    }

    setComments((prev) => [...prev, newComment])
    setCommentText('')
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
                <button
                  type="button"
                  aria-label="Post options"
                  className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-all duration-300"
                >
                  <MoreHorizontal className="w-[18px] h-[18px]" />
                </button>
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
            <button
              type="button"
              onClick={() => focusComposer()}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300"
            >
              <MessageCircle className="w-[18px] h-[18px]" />
              {comments.length}
            </button>
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

            {comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No comments yet — be the first to reply.</p>
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex items-start gap-2.5">
                    <Avatar initials={comment.initials} colorClass={comment.colorClass} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="rounded-2xl bg-gray-50 px-3.5 py-2.5">
                        <p className="text-xs font-semibold text-gray-900">{comment.author}</p>
                        <p className="text-sm text-gray-700 mt-0.5">{comment.text}</p>
                      </div>
                      <div className="mt-1 flex items-center gap-4 pl-1">
                        <span className="text-[11px] text-gray-400">{comment.time}</span>
                        <button
                          type="button"
                          onClick={() => toggleCommentLike(comment.id)}
                          className={`text-[11px] font-medium transition-all duration-300 ${
                            comment.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-blue-600'
                          }`}
                        >
                          Like{comment.likes > 0 ? ` (${comment.likes})` : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() => focusComposer(`@${comment.author} `)}
                          className="text-[11px] font-medium text-gray-400 hover:text-blue-600 transition-all duration-300"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <form
          onSubmit={handleSendComment}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-[480px] lg:max-w-[520px] bg-white/95 backdrop-blur-md border-t border-gray-100 px-3 py-2.5 flex items-center gap-2"
        >
          <Avatar initials={currentUserProfile.initials} colorClass={currentUserProfile.colorClass} size="sm" />
          <input
            ref={commentInputRef}
            type="text"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
          />
          <button
            type="submit"
            disabled={!commentText.trim()}
            aria-label="Send comment"
            className="w-9 h-9 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}