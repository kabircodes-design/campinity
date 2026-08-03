import { useEffect, useRef, useState } from 'react'

const COMMON_EMOJIS = [
  '❤️', '😂', '😍', '🔥', '👏', '😢', '😮', '🎉', '💯', '🙌',
  '😅', '🤔', '👍', '🙏', '😊', '😎', '💀', '🥹', '😭', '✨',
  '🥳', '😤', '🤯', '👀', '💪', '🫡', '😴', '🤝', '💙', '🌟'
]

const EMOJI_KEYWORDS = {
  '❤️': 'heart love',
  '😂': 'laugh lol funny',
  '😍': 'love heart eyes',
  '🔥': 'fire lit',
  '👏': 'clap',
  '😢': 'cry sad',
  '😮': 'wow surprised',
  '🎉': 'party celebrate',
  '💯': 'hundred perfect',
  '🙌': 'praise hands',
  '😅': 'sweat awkward',
  '🤔': 'think hmm',
  '👍': 'thumbs up good',
  '🙏': 'pray thanks please',
  '😊': 'smile happy',
  '😎': 'cool sunglasses',
  '💀': 'dead skull dying',
  '🥹': 'touched tears',
  '😭': 'crying sob',
  '✨': 'sparkle shiny',
  '🥳': 'celebrate party',
  '😤': 'mad determined',
  '🤯': 'mindblown shocked',
  '👀': 'eyes look',
  '💪': 'strong flex',
  '🫡': 'salute respect',
  '😴': 'sleep tired',
  '🤝': 'handshake deal',
  '💙': 'blue heart',
  '🌟': 'star'
}

const RECENT_KEY = 'campinity:recentEmojis'

function getRecentEmojis() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

function pushRecentEmoji(emoji) {
  const current = getRecentEmojis().filter((e) => e !== emoji)
  const next = [emoji, ...current].slice(0, 10)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable — recents just won't persist this session.
  }
  return next
}

/**
 * Lightweight, curated emoji set (not a full Unicode database — "no
 * bulky popup, fast performance" from the brief) with a
 * localStorage-backed recents row, plus simple text search across a
 * small keyword map. Closes on outside click and Escape.
 */
export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [recents, setRecents] = useState(getRecentEmojis)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) onClose()
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handlePick = (emoji) => {
    setRecents(pushRecentEmoji(emoji))
    onSelect(emoji)
  }

  const filtered = search.trim()
    ? COMMON_EMOJIS.filter((emoji) => (EMOJI_KEYWORDS[emoji] || '').includes(search.trim().toLowerCase()))
    : COMMON_EMOJIS

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 w-64 rounded-2xl border border-gray-100 bg-white shadow-lg p-3 z-50"
    >
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search emoji..."
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-blue-500 transition-all duration-200"
      />

      {recents.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Recent</p>
          <div className="mt-1 grid grid-cols-8 gap-1">
            {recents.map((emoji) => (
              <button
                key={`recent-${emoji}`}
                type="button"
                onClick={() => handlePick(emoji)}
                className="text-lg rounded-lg hover:bg-gray-100 p-1 transition-all duration-150"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mt-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Frequently used</p>
      <div className="mt-1 grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
        {filtered.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handlePick(emoji)}
            className="text-lg rounded-lg hover:bg-gray-100 p-1 transition-all duration-150"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
