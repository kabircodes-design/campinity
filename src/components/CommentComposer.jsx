import { useEffect, useRef, useState } from 'react'
import { Smile, X } from 'lucide-react'
import Avatar from './Avatar.jsx'
import EmojiPicker from './EmojiPicker.jsx'
import { searchUsersForMention } from '../firebase/engagementService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

const MAX_LENGTH = 500

/**
 * One composer, reused for: the top-level comment box, a reply
 * (replyingTo set), and edit mode (editingComment set) — not three
 * separate implementations. Auto-grows via a ref + scrollHeight
 * (textarea has no native auto-grow), Ctrl+Enter submits, plain Enter
 * inserts a newline (configurable behavior the brief asked for, this
 * project's mobile-first composers elsewhere — CreatePostPage.jsx —
 * don't submit on Enter either, so this matches that convention
 * rather than introducing a new one).
 *
 * Mention autocomplete: watches for an "@" followed by word characters
 * immediately before the cursor, debounces via a simple 200ms timer,
 * calls searchUsersForMention, and renders a dropdown with full
 * keyboard nav (ArrowUp/Down to move, Enter to select, Escape to
 * close) — mouse click also works. Selecting a user replaces the
 * partial "@harsh" with "@harshil " (full username) and tracks the
 * uid in mentionedUids, which the actual notification-sending logic
 * in engagementService.js needs (text alone can't resolve a username
 * back to a uid reliably — a username change after the fact would
 * silently misroute the notification).
 */
export default function CommentComposer({
  currentUser,
  onSubmit,
  placeholder = 'Add a comment...',
  replyingTo = null,
  onCancelReply,
  editingComment = null,
  onCancelEdit,
  autoFocus = false
}) {
  const [text, setText] = useState(editingComment?.text || '')
  const [mentionedUids, setMentionedUids] = useState(editingComment?.mentions || [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const [mentionQuery, setMentionQuery] = useState(null) // null = not actively mentioning
  const [mentionResults, setMentionResults] = useState([])
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)

  const textareaRef = useRef(null)
  const mentionDebounceRef = useRef(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([])
      return undefined
    }
    window.clearTimeout(mentionDebounceRef.current)
    mentionDebounceRef.current = window.setTimeout(async () => {
      try {
        const results = await searchUsersForMention(mentionQuery)
        setMentionResults(results)
        setMentionActiveIndex(0)
      } catch {
        setMentionResults([])
      }
    }, 200)
    return () => window.clearTimeout(mentionDebounceRef.current)
  }, [mentionQuery])

  const detectMentionTrigger = (value, cursorPos) => {
    const textBeforeCursor = value.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  const handleChange = (event) => {
    const value = event.target.value
    setText(value)
    detectMentionTrigger(value, event.target.selectionStart)
  }

  const selectMention = (user) => {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length
    const textBeforeCursor = text.slice(0, cursorPos)
    const textAfterCursor = text.slice(cursorPos)
    const replaced = textBeforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `@${user.username} `)

    setText(replaced + textAfterCursor)
    setMentionedUids((prev) => Array.from(new Set([...prev, user.uid])))
    setMentionQuery(null)

    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleKeyDown = (event) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMentionActiveIndex((i) => (i + 1) % mentionResults.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMentionActiveIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length)
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        selectMention(mentionResults[mentionActiveIndex])
        return
      }
      if (event.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      handleSubmit()
    }
  }

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji)
    setShowEmojiPicker(false)
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSubmit({ text: text.trim(), mentionedUids })
      setText('')
      setMentionedUids([])
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative">
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-lg bg-gray-50 text-xs text-gray-500">
          <span>
            Replying to <span className="font-semibold text-gray-700">{replyingTo.displayName}</span>
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {editingComment && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-lg bg-blue-50 text-xs text-blue-600">
          <span>Editing comment</span>
          <button type="button" onClick={onCancelEdit} aria-label="Cancel edit" className="text-blue-400 hover:text-blue-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Avatar
          initials={(currentUser?.displayName || '?').slice(0, 1).toUpperCase()}
          colorClass="from-gray-300 to-gray-400"
          size="sm"
          src={getProfileIdentityImage(currentUser)}
        />

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            maxLength={MAX_LENGTH}
            disabled={isSubmitting}
            placeholder={placeholder}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 pl-4 pr-16 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Add emoji"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          {showEmojiPicker && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmojiPicker(false)} />}

          {mentionQuery !== null && mentionResults.length > 0 && (
            <div className="absolute bottom-full mb-1.5 left-0 w-56 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-40 max-h-48 overflow-y-auto">
              {mentionResults.map((user, index) => (
                <button
                  key={user.uid}
                  type="button"
                  onClick={() => selectMention(user)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 ${
                    index === mentionActiveIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <Avatar
                    initials={(user.displayName || '?').slice(0, 1).toUpperCase()}
                    colorClass="from-gray-300 to-gray-400"
                    size="sm"
                    src={getProfileIdentityImage(user)}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          className="flex-shrink-0 rounded-full bg-blue-600 text-white text-xs font-semibold px-4 py-2.5 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
        >
          {isSubmitting ? '...' : editingComment ? 'Save' : 'Post'}
        </button>
      </div>

      <p className="mt-1 text-right text-[10.5px] text-gray-300">{text.length}/{MAX_LENGTH}</p>
    </div>
  )
}
