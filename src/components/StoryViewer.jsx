import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Heart, MessageCircle, Send, Share2, Trash2, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import {
  addStoryComment,
  deleteStory,
  deleteStoryComment,
  getStoryLikeCount,
  getStoryViewers,
  hasLikedStory,
  likeStory,
  recordStoryView,
  subscribeToStoryComments,
  unlikeStory
} from '../firebase/storyService.js'
import { createStoryCommentNotification, createStoryLikeNotification } from '../firebase/notificationService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getOrCreateChat, sendMessage } from '../firebase/chatService.js'
import ShareBottomSheet from '../sharing/ShareBottomSheet.jsx'
import Avatar from './Avatar.jsx'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

const STORY_DURATION_MS = 5000

/**
 * ROOT CAUSE FIX for the first-open black screen: the previous version
 * started the progress timer immediately on mount, with no loading
 * state on the <img>/<video> element at all. On a cold cache (a
 * freshly-uploaded Firebase Storage image the browser hasn't fetched
 * yet), the image takes real time to actually paint pixels — against
 * a bg-black container, that gap looked like a dead black screen,
 * while the 5s countdown was already silently running underneath. A
 * second open worked because the browser had since cached the image.
 * Fixed with a real LOADING -> READY -> ERROR lifecycle per story:
 * the progress timer now only starts once media.onLoad (image) or
 * onCanPlay (video) actually fires — confirmed correct for both media
 * types, not guessed.
 *
 * Stories 2.0 — now takes the FULL ordered list of viewable groups
 * (`groups`) plus `groupIndex` instead of a single `group`, so reaching
 * the end of one user's stories can continue into the next user's
 * (onChangeGroup) instead of always closing — "a stated scope boundary"
 * from the previous pass, now filled in. HomePage.jsx owns the actual
 * open/closed + which-group state; this component is purely driven by
 * props, so it never needs its own notion of "which bubble opened me."
 */
export default function StoryViewer({ groups, groupIndex, onClose, onChangeGroup, onDeleted, onViewed }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [mediaStatus, setMediaStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const { profile: myProfile } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [likeBusy, setLikeBusy] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const verified = useMyVerification()
  const [gateOpen, setGateOpen] = useState(false)
  const [replySent, setReplySent] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const startRef = useRef(null)
  const frameRef = useRef(null)
  const elapsedAtPauseRef = useRef(0)

  const group = groups[groupIndex]
  const stories = group?.stories || []
  const current = stories[index]
  const currentUid = auth.currentUser?.uid
  const isOwn = current?.userId === currentUid

  // Reset the within-group story index whenever the OPEN GROUP changes
  // (advancing to the next user, or the caller jumping bubbles) — a
  // fresh group always starts at its first story, never inherits the
  // previous group's index.
  useEffect(() => {
    setIndex(0)
  }, [groupIndex])

  // Media lifecycle resets on every story change — each story gets
  // its own fresh loading state, never inherits the previous one's
  // "ready" status.
  useEffect(() => {
    setMediaStatus('loading')
    setProgress(0)
    elapsedAtPauseRef.current = 0
    setReplyText('')
    setReplySent(false)
  }, [current?.id])

  // Likes — fetched once per story shown, not on every render/tick.
  useEffect(() => {
    if (!current || !currentUid) return
    let cancelled = false
    Promise.all([hasLikedStory(current.id, currentUid), getStoryLikeCount(current.id)]).then(([likedNow, count]) => {
      if (cancelled) return
      setLiked(likedNow)
      setLikeCount(count)
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [current?.id, currentUid])

  // Seen-tracking — recorded once per story actually displayed, not
  // per render. Own stories are never recorded as "viewed" (a story
  // owner isn't a viewer of their own story).
  useEffect(() => {
    if (!current || isOwn || !currentUid) return
    recordStoryView(current.id, currentUid).catch(() => {})
    onViewed?.(current.id)
  }, [current?.id, isOwn, currentUid, onViewed])

  // Progress timer — the actual fix: gated on mediaStatus === 'ready',
  // never starts while loading, stops entirely on error (an errored
  // story shouldn't silently auto-advance past a state the user never
  // saw).
  useEffect(() => {
    if (paused || mediaStatus !== 'ready') return
    startRef.current = performance.now() - elapsedAtPauseRef.current

    const tick = (now) => {
      const elapsed = now - startRef.current
      const pct = Math.min(elapsed / STORY_DURATION_MS, 1)
      setProgress(pct)
      if (pct >= 1) {
        goNext()
        return
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frameRef.current)
      elapsedAtPauseRef.current = performance.now() - startRef.current
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, groupIndex, paused, mediaStatus])

  // Cleanup on unmount — belt-and-braces alongside the effect's own
  // cleanup above, guarding against any leftover frame if the
  // component unmounts mid-tick.
  useEffect(() => {
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  // Keyboard navigation, per explicit requirement — ArrowLeft/Right/Escape.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'ArrowRight') goNext()
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, groupIndex, stories.length, groups.length])

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))

  const goNext = () => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1)
      return
    }
    // Continuous navigation (Part 11) — after this user's last story,
    // move into the next viewable group rather than always closing.
    if (groupIndex < groups.length - 1) {
      onChangeGroup(groupIndex + 1)
      return
    }
    onClose()
  }

  // Preload the NEXT story's media in the background (Part 5) — the
  // next story within this group if there is one, else the first
  // story of the next group. A plain hidden <img>/<video> is enough to
  // make the browser fetch and cache the resource ahead of time; no
  // library needed, and this never preloads more than exactly one
  // story ahead (no unbounded background downloads).
  const nextStory =
    index < stories.length - 1
      ? stories[index + 1]
      : groupIndex < groups.length - 1
        ? groups[groupIndex + 1]?.stories?.[0]
        : null

  const handleShowViewers = async () => {
    setShowComments(false)
    setPaused(true)
    setShowViewers(true)
    try {
      const results = await getStoryViewers(current.id)
      setViewers(results)
    } catch {
      setViewers([])
    }
  }

  const handleCloseViewers = () => {
    setShowViewers(false)
    setPaused(false)
  }

  // Real-time, unlike Viewers' one-shot fetch above — comments left
  // while the panel is open should appear live, matching how they'd
  // behave anywhere else in the app. Subscribes only while the panel is
  // actually open, and unsubscribes on close AND on story change (the
  // effect's own cleanup), so this never leaks a listener for a story
  // that's no longer being viewed.
  useEffect(() => {
    if (!showComments || !current?.id) {
      setComments([])
      return undefined
    }
    const unsubscribe = subscribeToStoryComments(current.id, setComments)
    return () => unsubscribe()
  }, [showComments, current?.id])

  const handleShowComments = () => {
    setShowViewers(false)
    setPaused(true)
    setShowComments(true)
  }

  const handleCloseComments = () => {
    setShowComments(false)
    setPaused(false)
  }

  const handleSendComment = async () => {
    const text = commentText.trim()
    if (!text || commentSending || !current?.id || !currentUid) return
    setCommentSending(true)
    try {
      await addStoryComment(current.id, {
        uid: currentUid,
        displayName: myProfile?.displayName,
        username: myProfile?.username,
        avatar: myProfile?.avatar,
        text
      })
      setCommentText('')
      createStoryCommentNotification({
        targetUid: current.userId,
        actorUid: currentUid,
        actorName: myProfile?.displayName || myProfile?.username,
        actorAvatar: myProfile?.avatar,
        storyId: current.id,
        commentPreview: text.slice(0, 120)
      }).catch(() => {})
    } catch {
      // Same as story replies below — the input just keeps its text so the user can retry, no separate error toast for one inline field.
    } finally {
      setCommentSending(false)
    }
  }

  const handleDeleteComment = (commentId) => {
    if (!current?.id || !currentUid) return
    deleteStoryComment(current.id, commentId, currentUid).catch(() => {})
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteStory(current.id, current.storagePath)
      onDeleted?.(current.id)
      if (stories.length > 1) {
        if (index >= stories.length - 1) setIndex((i) => Math.max(0, i - 1))
      } else if (groupIndex < groups.length - 1) {
        onChangeGroup(groupIndex + 1)
      } else {
        onClose()
      }
    } catch {
      setDeleting(false)
    }
  }

  const handleToggleLike = async () => {
    if (likeBusy || !current || !currentUid) return
    setLikeBusy(true)
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)))
    try {
      if (nextLiked) {
        await likeStory(current.id, currentUid)
        createStoryLikeNotification({
          targetUid: current.userId,
          actorUid: currentUid,
          actorName: myProfile?.displayName || myProfile?.username,
          actorAvatar: myProfile?.avatar,
          storyId: current.id
        }).catch(() => {})
      } else {
        await unlikeStory(current.id, currentUid)
      }
    } catch {
      setLiked(!nextLiked)
      setLikeCount((prev) => Math.max(0, prev + (nextLiked ? -1 : 1)))
    } finally {
      setLikeBusy(false)
    }
  }

  // Story replies become real DMs (Part 7) — reuses getOrCreateChat +
  // sendMessage exactly as they exist (the same functions the whole
  // rest of the app's messaging goes through), attaching the story as
  // a sharedPayload the same shape ShareBottomSheet/shareService.js
  // already produce, so it renders through SharedCard's existing
  // shared_story entry — no second, parallel reply/comment system.
  const handleSendReply = async () => {
    const text = replyText.trim()
    if (!text || replySending || !current || !currentUid || isOwn) return
    if (verified === false) {
      setGateOpen(true)
      return
    }
    setReplySending(true)
    try {
      const { chatId } = await getOrCreateChat(currentUid, current.userId)
      await sendMessage(chatId, currentUid, text, {
        type: 'shared_story',
        sharedPayload: {
          referenceId: current.id,
          referenceType: 'story',
          preview: { title: `${group.label}'s story`, image: current.mediaType === 'image' ? current.mediaUrl : null }
        }
      })
      setReplyText('')
      setReplySent(true)
      window.setTimeout(() => setReplySent(false), 1600)
    } catch {
      // Reply failure stays local/silent-but-visible via the input
      // simply keeping its text (nothing was cleared) — the user can
      // just press send again, no separate error toast needed for a
      // single inline text field.
    } finally {
      setReplySending(false)
    }
  }

  if (!current) return null

  return (
    <>
      {createPortal(
        <AnimatePresence>
          <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      >
        <div className="relative w-full h-full max-w-[480px] mx-auto overflow-hidden">
          {/* Media layer, always behind everything else */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            {mediaStatus === 'error' ? (
              <div className="text-center px-6">
                <p className="text-white/80 text-sm">Couldn't load this story</p>
                <div className="mt-3 flex items-center gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setMediaStatus('loading')}
                    className="rounded-full bg-white/10 text-white text-xs font-semibold px-4 py-2"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-full bg-white/10 text-white text-xs font-semibold px-4 py-2"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : current.mediaType === 'video' ? (
              <video
                key={current.id}
                src={current.mediaUrl}
                autoPlay
                muted
                playsInline
                onCanPlay={() => setMediaStatus('ready')}
                onError={() => setMediaStatus('error')}
                className={`w-full h-full object-contain transition-opacity duration-300 ${
                  mediaStatus === 'ready' ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ) : (
              <img
                key={current.id}
                src={current.mediaUrl}
                alt=""
                onLoad={() => setMediaStatus('ready')}
                onError={() => setMediaStatus('error')}
                className={`w-full h-full object-contain transition-opacity duration-300 ${
                  mediaStatus === 'ready' ? 'opacity-100' : 'opacity-0'
                }`}
              />
            )}
            {/* Elegant loading state — never a bare black canvas */}
            {mediaStatus === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 border-2 border-white/25 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Invisible preloader for the NEXT story only — never
              rendered visibly, never more than one story ahead. */}
          {nextStory && (
            nextStory.mediaType === 'video' ? (
              <video src={nextStory.mediaUrl} preload="auto" muted className="hidden" aria-hidden="true" />
            ) : (
              <img src={nextStory.mediaUrl} alt="" className="hidden" aria-hidden="true" />
            )
          )}

          {/* Tap-navigation zones — deliberately start BELOW the top
              bar (top-16, not inset-y-0) so they can never intercept
              clicks meant for Close/Delete/Viewers, fixing the
              "sometimes can't be dismissed" bug caused by the
              previous full-height overlay sitting on top of the
              header in DOM order. */}
          {!showViewers && !showComments && mediaStatus !== 'error' && (
            <>
              <button type="button" aria-label="Previous story" onClick={goPrev} className="absolute top-16 bottom-24 left-0 w-1/3 z-10" />
              <button type="button" aria-label="Next story" onClick={goNext} className="absolute top-16 bottom-24 right-0 w-2/3 z-10" />
            </>
          )}

          {/* Progress bars */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1">
            {stories.map((s, i) => (
              <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white transition-none"
                  style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
                />
              </div>
            ))}
          </div>

          {/* Top bar — always clickable, always on top (z-20, above the nav zones' z-10) */}
          <div className="absolute top-7 left-3 right-3 z-20 flex items-center gap-2">
            <Avatar initials={getInitials(group.label)} colorClass={getAvatarColor(group.userId)} size="sm" src={group.avatar || undefined} />
            <span className="text-white text-sm font-semibold drop-shadow">{group.label}</span>
            {isOwn && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete story"
                className="ml-auto text-white/80 hover:text-white disabled:opacity-50"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={isOwn ? 'text-white/90 hover:text-white' : 'ml-auto text-white/90 hover:text-white'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isOwn && mediaStatus === 'ready' && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={handleShowViewers}
                className="flex items-center gap-1.5 rounded-full bg-black/40 text-white text-xs font-medium px-3.5 py-2"
              >
                <Eye className="w-3.5 h-3.5" /> Seen
              </button>
              <button
                type="button"
                onClick={handleShowComments}
                className="flex items-center gap-1.5 rounded-full bg-black/40 text-white text-xs font-medium px-3.5 py-2"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Comments
              </button>
            </div>
          )}

          {/* Reply + like + share bar — mirrors Instagram's bottom row,
              never shown on your own story (a "Seen" pill takes that
              spot instead, above). pb-[env(safe-area-inset-bottom)]
              keeps it clear of the home-indicator/notch area. */}
          {!isOwn && !showViewers && !showComments && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <div className="flex-1 flex items-center rounded-full bg-white/15 backdrop-blur-sm px-3.5 py-2.5">
                <input
                  type="text"
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  onKeyDown={(event) => event.key === 'Enter' && handleSendReply()}
                  placeholder={`Reply to ${group.label.split(' ')[0]}...`}
                  aria-label={`Reply to ${group.label}`}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 outline-none"
                />
              </div>
              {replyText.trim() && (
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={replySending}
                  aria-label="Send reply"
                  className="w-10 h-10 flex-shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-white disabled:opacity-50 transition-all duration-200 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={likeBusy}
                aria-label={liked ? 'Unlike story' : 'Like story'}
                aria-pressed={liked}
                className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform duration-150"
              >
                <Heart className="w-5.5 h-5.5" fill={liked ? '#3b82f6' : 'none'} stroke={liked ? '#3b82f6' : 'currentColor'} />
              </button>
              <button
                type="button"
                onClick={handleShowComments}
                aria-label="Comments"
                className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform duration-150"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaused(true)
                  setShareOpen(true)
                }}
                aria-label="Share story"
                className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform duration-150"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          )}

          {replySent && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 rounded-full bg-black/70 text-white text-xs font-medium px-3.5 py-2">
              Reply sent
            </div>
          )}

          {likeCount > 0 && !isOwn && (
            <p className="absolute bottom-[4.5rem] left-4 z-20 text-white/70 text-[11px]">
              {likeCount} {likeCount === 1 ? 'like' : 'likes'}
            </p>
          )}

          {showViewers && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] bg-black/90 rounded-t-2xl px-4 pt-4 pb-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white text-sm font-semibold">Viewers ({viewers.length})</span>
                <button type="button" onClick={handleCloseViewers} aria-label="Close viewers" className="text-white/70 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {viewers.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-4">No views yet.</p>
              ) : (
                <div className="space-y-3">
                  {viewers.map((v) => (
                    <div key={v.viewerUid} className="flex items-center gap-2.5">
                      <Avatar initials={getInitials(v.displayName)} colorClass={getAvatarColor(v.viewerUid)} size="sm" src={v.avatar || undefined} />
                      <div>
                        <p className="text-white text-sm">{v.displayName}</p>
                        {v.username && <p className="text-white/50 text-xs">@{v.username}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showComments && (
            <div className="absolute inset-x-0 bottom-0 z-30 max-h-[65%] bg-black/90 rounded-t-2xl px-4 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <span className="text-white text-sm font-semibold">Comments ({comments.length})</span>
                <button type="button" onClick={handleCloseComments} aria-label="Close comments" className="text-white/70 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-[60px]">
                {comments.length === 0 ? (
                  <p className="text-white/50 text-sm text-center py-4">No comments yet.</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <Avatar initials={getInitials(c.displayName)} colorClass={getAvatarColor(c.uid)} size="sm" src={c.avatar || undefined} />
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm">
                            <span className="font-semibold">{c.displayName}</span>{' '}
                            <span className="text-white/80">{c.text}</span>
                          </p>
                        </div>
                        {c.uid === currentUid && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            aria-label="Delete comment"
                            className="flex-shrink-0 text-white/40 hover:text-white/80"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-shrink-0">
                <div className="flex-1 flex items-center rounded-full bg-white/15 px-3.5 py-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSendComment()}
                    placeholder="Add a comment..."
                    aria-label="Add a comment"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/60 outline-none"
                  />
                </div>
                {commentText.trim() && (
                  <button
                    type="button"
                    onClick={handleSendComment}
                    disabled={commentSending}
                    aria-label="Post comment"
                    className="w-9 h-9 flex-shrink-0 rounded-full bg-blue-600 flex items-center justify-center text-white disabled:opacity-50 transition-all duration-200 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      <ShareBottomSheet
        open={shareOpen}
        onClose={() => {
          setShareOpen(false)
          setPaused(false)
        }}
        referenceType="story"
        referenceId={current.id}
        preview={{
          title: `${group.label}'s story`,
          subtitle: group.username ? `@${group.username}` : '',
          image: current.mediaType === 'image' ? current.mediaUrl : null
        }}
      />

      <VerificationGate open={gateOpen} onClose={() => setGateOpen(false)} feature={FEATURES.SEND_MESSAGE} />
    </>
  )
}
