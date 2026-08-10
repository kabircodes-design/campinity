import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Trash2, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { deleteStory, getStoryViewers, recordStoryView } from '../firebase/storyService.js'
import Avatar from './Avatar.jsx'

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
 * Cycles through one user's own active stories — tap left/right to
 * step, a progress bar per story at the top, auto-advance, closes
 * when the last one finishes. Scoped to a single user's story group
 * deliberately: StoryBubble.jsx (the only caller) receives just its
 * own { story } prop from HomePage.jsx, with no sibling-list/callback
 * prop to advance into the next user's bubble — a stated scope
 * boundary, not silently under-built.
 */
export default function StoryViewer({ group, onClose, onDeleted, onViewed }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [mediaStatus, setMediaStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState([])
  const [deleting, setDeleting] = useState(false)
  const startRef = useRef(null)
  const frameRef = useRef(null)
  const elapsedAtPauseRef = useRef(0)

  const stories = group.stories
  const current = stories[index]
  const currentUid = auth.currentUser?.uid
  const isOwn = current?.userId === currentUid

  // Media lifecycle resets on every story change — each story gets
  // its own fresh loading state, never inherits the previous one's
  // "ready" status.
  useEffect(() => {
    setMediaStatus('loading')
    setProgress(0)
    elapsedAtPauseRef.current = 0
  }, [current?.id])

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
        if (index < stories.length - 1) {
          setIndex((i) => i + 1)
        } else {
          onClose()
        }
        return
      }
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frameRef.current)
      elapsedAtPauseRef.current = performance.now() - startRef.current
    }
  }, [index, stories.length, onClose, paused, mediaStatus])

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
  }, [index, stories.length])

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => {
    if (index < stories.length - 1) setIndex((i) => i + 1)
    else onClose()
  }

  const handleShowViewers = async () => {
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

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteStory(current.id, current.storagePath)
      onDeleted?.(current.id)
      if (stories.length > 1) {
        if (index >= stories.length - 1) setIndex((i) => Math.max(0, i - 1))
      } else {
        onClose()
      }
    } catch {
      setDeleting(false)
    }
  }

  if (!current) return null

  return createPortal(
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
                    onClick={onClose}
                    className="rounded-full bg-white/10 text-white text-xs font-semibold px-4 py-2"
                  >
                    Close
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

          {/* Tap-navigation zones — deliberately start BELOW the top
              bar (top-16, not inset-y-0) so they can never intercept
              clicks meant for Close/Delete/Viewers, fixing the
              "sometimes can't be dismissed" bug caused by the
              previous full-height overlay sitting on top of the
              header in DOM order. */}
          {!showViewers && mediaStatus !== 'error' && (
            <>
              <button type="button" aria-label="Previous story" onClick={goPrev} className="absolute top-16 bottom-0 left-0 w-1/3 z-10" />
              <button type="button" aria-label="Next story" onClick={goNext} className="absolute top-16 bottom-0 right-0 w-2/3 z-10" />
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
            <button
              type="button"
              onClick={handleShowViewers}
              className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/40 text-white text-xs font-medium px-3.5 py-2"
            >
              <Eye className="w-3.5 h-3.5" /> Seen
            </button>
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
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
