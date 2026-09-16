import { useEffect, useState } from 'react'
import { subscribeToTypingState } from '../firebase/chatService.js'

/**
 * Deliberately its own component, not inline in ChatPage — it owns its
 * own useState/useEffect so a typing flicker only ever re-renders this
 * small leaf, never ChatPage or the message list. Meant to be rendered
 * OUTSIDE the scrollable message <main> (a sibling row between it and
 * the composer), so its mount/unmount can never change that container's
 * scrollHeight — nothing to coordinate with the existing near-bottom/
 * auto-scroll logic, no scroll-jump risk by construction.
 */
export default function TypingIndicator({ chatId, currentUid, otherDisplayName }) {
  const [typingUids, setTypingUids] = useState([])

  useEffect(() => {
    setTypingUids([])
    if (!chatId || !currentUid) return undefined
    const unsubscribe = subscribeToTypingState(chatId, currentUid, setTypingUids)
    return () => unsubscribe()
  }, [chatId, currentUid])

  if (typingUids.length === 0) return null

  const label =
    typingUids.length > 1 ? 'Several people are typing...' : otherDisplayName ? `${otherDisplayName} is typing...` : 'Typing...'

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400 [animation:fadeIn_150ms_ease-out]">
      <span className="flex items-center gap-0.5" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 [animation:typingDotBounce_1.2s_ease-in-out_infinite]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 [animation:typingDotBounce_1.2s_ease-in-out_infinite_0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 [animation:typingDotBounce_1.2s_ease-in-out_infinite_0.3s]" />
      </span>
      <span>{label}</span>
    </div>
  )
}
