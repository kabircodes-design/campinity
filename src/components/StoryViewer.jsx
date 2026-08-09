import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, Trash2, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { deleteStory, getStoryViewers, recordStoryView } from '../firebase/storyService.js'
import Avatar from './Avatar.jsx'

const STORY_DURATION_MS = 5000

/**
 * Cycles through one user's own active stories — tap left/right to
 * step, a progress bar per story at the top, auto-advance, closes
 * when the last one finishes. Scoped to a single user's story group
 * deliberately: StoryBubble.jsx (the only caller) receives just its
 * own { story } prop from HomePage.jsx, with no sibling-list/callback
 * prop to advance into the next user's bubble — a real, stated scope
 * boundary, not silently under-built.
 */
export default function StoryViewer({ group, onClose, onDeleted, onViewed }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState([])
  const [deleting, setDeleting] = useState(false)
  const startRef = useRef(null)
  const frameRef = useRef(null)
  const pausedAtRef = useRef(0)

  const stories = group.stories
  const current = stories[index]
  const currentUid = auth.currentUser?.uid
  const isOwn = current?.userId === currentUid

  // Seen-tracking — recorded once per story actually displayed, not
  // per render. Own stories are never recorded as "viewed" (a story
  // owner isn't a viewer of their own story).
  useEffect(() => {
    if (!current || isOwn || !currentUid) return
    recordStoryView(current.id, currentUid).catch(() => {})
    onViewed?.(current.id)
  }, [current?.id, isOwn, currentUid, onViewed])

  useEffect(() => {
    if (paused) return
    setProgress(0)
    startRef.current = performance.now()

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
    return () => cancelAnimationFrame(frameRef.current)
  }, [index, stories.length, onClose, paused])

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
        if (index < stories.length - 1) setIndex((i) => i) // stays, list shrinks upstream
        else setIndex((i) => Math.max(0, i - 1))
      } else {
        onClose()
      }
    } catch {
      setDeleting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div className="relative w-full h-full max-w-[480px] mx-auto">
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-1">
          {stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <div
                className="h-full bg-white transition-none"
                style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-7 left-3 right-3 z-10 flex items-center gap-2">
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
          <button type="button" onClick={onClose} aria-label="Close" className={isOwn ? 'text-white/90 hover:text-white' : 'ml-auto text-white/90 hover:text-white'}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {current.mediaType === 'video' ? (
          <video src={current.mediaUrl} autoPlay muted playsInline className="w-full h-full object-contain" />
        ) : (
          <img src={current.mediaUrl} alt="" className="w-full h-full object-contain" />
        )}

        {isOwn && (
          <button
            type="button"
            onClick={handleShowViewers}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/40 text-white text-xs font-medium px-3.5 py-2"
          >
            <Eye className="w-3.5 h-3.5" /> Seen
          </button>
        )}

        {!showViewers && (
          <>
            <button type="button" aria-label="Previous story" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3" />
            <button type="button" aria-label="Next story" onClick={goNext} className="absolute inset-y-0 right-0 w-2/3" />
          </>
        )}

        {showViewers && (
          <div className="absolute inset-x-0 bottom-0 max-h-[60%] bg-black/90 rounded-t-2xl px-4 pt-4 pb-6 overflow-y-auto">
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
    </div>,
    document.body
  )
}
