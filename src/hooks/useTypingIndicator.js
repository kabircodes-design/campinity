import { useEffect, useRef } from 'react'
import { setTypingState } from '../firebase/chatService.js'

const STOP_TYPING_DELAY_MS = 1800

/**
 * Composer-side broadcast half of the typing indicator. Debounced by
 * design: a Firestore write only happens on the not-typing -> typing
 * transition and on the eventual stop — never once per keystroke.
 * notifyTyping() is meant to be called from the composer's onChange;
 * stopTyping() from send / composer-empty / attachment-clear.
 *
 * isTypingRef/timeoutRef are refs (not state) on purpose — this hook's
 * own re-renders would otherwise ripple into whatever renders the
 * composer, for state that never needs to paint anything itself.
 */
export function useTypingBroadcast(chatId, uid) {
  const isTypingRef = useRef(false)
  const timeoutRef = useRef(null)

  const stopTyping = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (isTypingRef.current) {
      isTypingRef.current = false
      setTypingState(chatId, uid, false)
    }
  }

  const notifyTyping = () => {
    if (!chatId || !uid) return
    if (!isTypingRef.current) {
      isTypingRef.current = true
      setTypingState(chatId, uid, true)
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(stopTyping, STOP_TYPING_DELAY_MS)
  }

  // Covers "chat closed/unmounted" and "component/page changes" — this
  // effect's cleanup captures THIS render's chatId/uid closure, so
  // switching chatId (or unmounting entirely) clears typing state for
  // the conversation being left, not whatever chat is opened next.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (isTypingRef.current) {
        isTypingRef.current = false
        setTypingState(chatId, uid, false)
      }
    }
  }, [chatId, uid])

  return { notifyTyping, stopTyping }
}
