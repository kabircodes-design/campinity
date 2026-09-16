import { useEffect, useRef, useState } from 'react'
import { searchUsersForMention } from '../firebase/engagementService.js'

/**
 * Same mention-detection/selection logic CommentComposer.jsx already
 * has inline — extracted here as a fresh, reusable hook rather than
 * refactoring that already-working composer (which Phase 3's own
 * "Phase 1/2 functionality must remain stable" rules out touching).
 * Reuses the exact same backend (searchUsersForMention) and the same
 * `@username ` replacement convention, so mention data written by
 * either composer is identical in shape.
 */
export function useMentionAutocomplete(text, setText, textareaRef) {
  const [mentionedUids, setMentionedUids] = useState([])
  const [mentionQuery, setMentionQuery] = useState(null) // null = not actively mentioning
  const [mentionResults, setMentionResults] = useState([])
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([])
      return undefined
    }
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await searchUsersForMention(mentionQuery)
        setMentionResults(results)
        setMentionActiveIndex(0)
      } catch {
        setMentionResults([])
      }
    }, 200)
    return () => window.clearTimeout(debounceRef.current)
  }, [mentionQuery])

  const detectMentionTrigger = (value, cursorPos) => {
    const textBeforeCursor = value.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/)
    setMentionQuery(match ? match[1] : null)
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

  /** Returns true if it handled the key (caller should skip its own handling for that event). */
  const handleMentionKeyDown = (event) => {
    if (mentionQuery === null || mentionResults.length === 0) return false
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setMentionActiveIndex((i) => (i + 1) % mentionResults.length)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setMentionActiveIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length)
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      selectMention(mentionResults[mentionActiveIndex])
      return true
    }
    if (event.key === 'Escape') {
      setMentionQuery(null)
      return true
    }
    return false
  }

  return {
    mentionedUids,
    mentionQuery,
    mentionResults,
    mentionActiveIndex,
    detectMentionTrigger,
    selectMention,
    handleMentionKeyDown
  }
}
