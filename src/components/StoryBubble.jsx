import { useState } from 'react'
import { Plus } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import StoryComposer from './StoryComposer.jsx'

/**
 * Matches HomePage.jsx's call site — <StoryBubble story={story}
 * seen={boolean} onOpen onViewed onDeleted />.
 *
 * Three shapes of `story`: { isMore: true } for the trailing "More"
 * bubble (inert, no destination exists for it); a real story GROUP
 * ({ userId, label, avatar, stories: [...] }) for every other user;
 * and { isAdd: true, stories: [...] } for "Your Story" — dual-purpose,
 * opening the viewer if the user already has active stories, else the
 * composer. HomePage.jsx filters the current user's own group out of
 * every other bubble and merges it into this one instead — so this
 * story object is the ONLY place the current user's stories ever
 * appear, never duplicated as a second, indistinguishable bubble.
 *
 * Stories 2.0 — this component no longer owns the viewer itself (it
 * used to mount a fresh <StoryViewer> per bubble). Continuous
 * cross-user navigation (tap through user A's last story straight
 * into user B's first) needs ONE viewer instance that knows the whole
 * ordered list of groups, not one scoped to a single bubble — so
 * HomePage.jsx now owns that single shared viewer, and this component
 * is just its trigger via the onOpen callback.
 */
export default function StoryBubble({ story, seen = false, onOpen }) {
  const [composerOpen, setComposerOpen] = useState(false)

  const hasActiveStory = !story.isMore && story.stories?.length > 0

  const handleClick = () => {
    if (story.isMore) return
    if (hasActiveStory) {
      onOpen?.()
    } else if (story.isAdd) {
      setComposerOpen(true)
    }
  }

  const handleAddClick = (event) => {
    event.stopPropagation()
    setComposerOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0 active:scale-95 transition-transform duration-150"
      >
        <div
          className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center transition-all duration-300 ${
            hasActiveStory
              ? seen
                ? 'p-[2px] bg-gray-300'
                // Campinity blue, not Instagram's rainbow — a subtle
                // two-tone blue ring plus a soft blue glow, per the
                // explicit "no rainbow gradients" requirement. Same
                // blue-600 already used for every primary action in
                // this app (composer, buttons, links) — not a new color.
                : 'p-[2.5px] bg-gradient-to-tr from-blue-500 to-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
              : ''
          }`}
        >
          <div className={hasActiveStory ? 'w-full h-full rounded-full bg-white p-[2px]' : 'w-full h-full'}>
            <Avatar
              initials={getInitials(story.label || story.initials)}
              colorClass={story.colorClass || getAvatarColor(story.userId || story.id)}
              size="lg"
              src={story.avatar || undefined}
            />
          </div>
          {story.isAdd && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleAddClick}
              onKeyDown={(e) => e.key === 'Enter' && handleAddClick(e)}
              aria-label="Add to your story"
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 border-[2.5px] border-white flex items-center justify-center shadow-sm"
            >
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </span>
          )}
        </div>
        <span className="text-[11px] leading-none text-gray-600 truncate w-full text-center">{story.label}</span>
      </button>

      {composerOpen && (
        <StoryComposer onClose={() => setComposerOpen(false)} onCreated={() => window.location.reload()} />
      )}
    </>
  )
}
