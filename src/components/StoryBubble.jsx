import { useState } from 'react'
import { Plus } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import StoryComposer from './StoryComposer.jsx'
import StoryViewer from './StoryViewer.jsx'

/**
 * Matches HomePage.jsx's exact existing call site — <StoryBubble
 * story={story} />, no other prop — confirmed by reading that usage
 * directly before writing this. Since no callback/sibling-list prop
 * is passed down, this component owns its own modal state (composer
 * or viewer), opened per-bubble on click.
 *
 * Three shapes of `story`, matching HomePage.jsx's storyBubbles array
 * exactly: { isAdd: true } for "Your Story", { isMore: true } for the
 * trailing "More" bubble (rendered inert — no real destination exists
 * for it, so it's not wired to open anything rather than faking one),
 * and a real story GROUP ({ userId, label, avatar, stories: [...] })
 * for every other user — this is what makes the Story button's real
 * fix concrete: tapping a real bubble opens the VIEWER
 * (stories/{storyId} documents), tapping "Your Story" opens the
 * COMPOSER, which creates a new stories/{storyId} document — never a
 * post, never CreatePostPage.
 */
export default function StoryBubble({ story }) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const handleClick = () => {
    if (story.isAdd) {
      setComposerOpen(true)
    } else if (!story.isMore) {
      setViewerOpen(true)
    }
  }

  const hasActiveStory = !story.isAdd && !story.isMore && story.stories?.length > 0

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex flex-col items-center gap-1 w-16 flex-shrink-0"
      >
        <div
          className={`relative w-14 h-14 rounded-full flex items-center justify-center ${
            hasActiveStory ? 'p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-500' : ''
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
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-600 truncate w-full text-center">{story.label}</span>
      </button>

      {composerOpen && (
        <StoryComposer onClose={() => setComposerOpen(false)} onCreated={() => window.location.reload()} />
      )}
      {viewerOpen && hasActiveStory && <StoryViewer group={story} onClose={() => setViewerOpen(false)} />}
    </>
  )
}
