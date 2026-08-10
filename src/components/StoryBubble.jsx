import { useState } from 'react'
import { Plus } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import StoryComposer from './StoryComposer.jsx'
import StoryViewer from './StoryViewer.jsx'

/**
 * Matches HomePage.jsx's exact existing call site — <StoryBubble
 * story={story} seen={boolean} onViewed onDeleted />.
 *
 * Three shapes of `story`: { isMore: true } for the trailing "More"
 * bubble (inert, no destination exists for it); a real story GROUP
 * ({ userId, label, avatar, stories: [...] }) for every other user;
 * and { isAdd: true, stories: [...] } for "Your Story" — this last
 * one is now genuinely dual-purpose, fixing the earlier bug where it
 * only ever opened the composer even when the user already had active
 * stories. HomePage.jsx now filters the current user's own group out
 * of every other bubble and merges it into this one instead — so this
 * story object is the ONLY place the current user's stories ever
 * appear, never duplicated as a second, indistinguishable bubble.
 *
 * Click behavior: tapping the main avatar opens the VIEWER if
 * story.stories has entries (own or otherwise), else opens the
 * COMPOSER for "Your Story" with none yet. The small "+" badge (only
 * shown on "Your Story") is now its own stopPropagation'd target that
 * always opens the composer, regardless of whether they already have
 * active stories — matching "optionally provide a subtle add-story
 * affordance" even when the ring already shows their own story.
 */
export default function StoryBubble({ story, seen = false, onViewed, onDeleted }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const hasActiveStory = !story.isMore && story.stories?.length > 0

  const handleClick = () => {
    if (story.isMore) return
    if (hasActiveStory) {
      setViewerOpen(true)
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
                : 'p-[2.5px] bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-600 shadow-[0_0_0_1px_rgba(236,72,153,0.08)]'
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
      {viewerOpen && hasActiveStory && (
        <StoryViewer group={story} onClose={() => setViewerOpen(false)} onDeleted={onDeleted} onViewed={onViewed} />
      )}
    </>
  )
}
