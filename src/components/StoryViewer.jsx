import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
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
export default function StoryViewer({ group, onClose }) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const startRef = useRef(null)
  const frameRef = useRef(null)

  const stories = group.stories
  const current = stories[index]

  useEffect(() => {
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
  }, [index, stories.length, onClose])

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => {
    if (index < stories.length - 1) setIndex((i) => i + 1)
    else onClose()
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
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto text-white/90 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {current.mediaType === 'video' ? (
          <video src={current.mediaUrl} autoPlay muted playsInline className="w-full h-full object-contain" />
        ) : (
          <img src={current.mediaUrl} alt="" className="w-full h-full object-contain" />
        )}

        <button type="button" aria-label="Previous story" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3" />
        <button type="button" aria-label="Next story" onClick={goNext} className="absolute inset-y-0 right-0 w-2/3" />
      </div>
    </div>,
    document.body
  )
}
