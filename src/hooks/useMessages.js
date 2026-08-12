import { useEffect, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { subscribeToMessages, sendMessage as sendMessageToFirestore, markChatRead } from '../firebase/chatService.js'

/**
 * Return shape matches ChatPage.jsx's actual destructuring:
 * { messages, loading, error, sending, sendMessage }.
 *
 * Optimistic send: a message with `pending: true` and a fake
 * client-side id is added to local state immediately, BEFORE the
 * Firestore write resolves — ChatPage.jsx's own dayLabelFor logic
 * already special-cases `message.pending` (labels it "Today"
 * unconditionally, since a pending message has no real createdAt yet),
 * confirming this exact optimistic-flag pattern is what that page
 * expects, not something invented here. Once the real onSnapshot
 * delivers the persisted message, the optimistic entry is removed
 * (matched by matching senderId + text among still-pending optimistic
 * entries) so it isn't shown twice.
 *
 * Marks the chat read on mount (opening a chat reads its unread
 * incoming messages), not on every message list update.
 */
export function useMessages(chatId, otherUid) {
  const [messages, setMessages] = useState([])
  const [optimisticMessages, setOptimisticMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const uid = auth.currentUser?.uid

  useEffect(() => {
    if (!chatId) return undefined
    setLoading(true)
    setError('')

    const unsubscribe = subscribeToMessages(chatId, (data) => {
      setMessages(data)
      setLoading(false)
      // 1-to-1 matching, not .some() — a single real message must only
      // ever clear ONE optimistic entry, never multiple. The previous
      // .some()-based check let a single incoming message with a
      // common text (e.g. "ok") match every optimistic entry sharing
      // that text, which could make a second, still-in-flight message
      // with identical text disappear before it was actually
      // confirmed. Each real message is consumed by at most one
      // optimistic match, then removed from further consideration.
      setOptimisticMessages((prev) => {
        const availableReal = [...data]
        return prev.filter((optimistic) => {
          const matchIndex = availableReal.findIndex(
            (real) => real.senderId === optimistic.senderId && real.text === optimistic.text
          )
          if (matchIndex === -1) return true
          availableReal.splice(matchIndex, 1)
          return false
        })
      })
    })

    return unsubscribe
  }, [chatId])

  useEffect(() => {
    if (!chatId || !uid) return
    markChatRead(chatId, uid).catch(() => {})
  }, [chatId, uid])

  const attemptSend = async (optimisticEntry, text, options) => {
    const { type = 'text', imageUrl = null } = options
    try {
      await sendMessageToFirestore(chatId, uid, text || '', { type, imageUrl })
    } catch (err) {
      // Real fix, not a debugging aid: previously this removed the
      // optimistic entry entirely on failure, meaning a failed
      // message silently vanished with no trace. Now it's marked
      // failed and kept visible, so MessageBubble.jsx can render
      // "Failed to send" + Retry — matching "do not silently
      // disappear" exactly.
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === optimisticEntry.id ? { ...m, pending: false, failed: true } : m))
      )
      if (err?.code === 'permission-denied') {
        setError("You can't message this person right now.")
      } else {
        setError(err?.message || 'Could not send this message.')
      }
    }
  }

  const sendMessage = async (text, options = {}) => {
    const { type = 'text', imageUrl = null } = options
    if (!chatId || !uid) return
    if (type === 'text' && !text?.trim()) return
    setSending(true)
    setError('')

    const optimisticEntry = {
      id: `optimistic-${Date.now()}`,
      senderId: uid,
      text: text?.trim() || '',
      type,
      imageUrl,
      read: false,
      edited: false,
      deletedFor: [],
      pending: true,
      failed: false,
      createdAt: null
    }
    setOptimisticMessages((prev) => [...prev, optimisticEntry])
    await attemptSend(optimisticEntry, text, options)
    setSending(false)
  }

  /**
   * Retries the SAME failed message in place — resends identical
   * text/type/imageUrl, flips it back to pending, never creates a
   * second/duplicate entry. Matches "Retry should resend the SAME
   * message. Do not duplicate messages" exactly.
   */
  const retryMessage = async (optimisticId) => {
    const entry = optimisticMessages.find((m) => m.id === optimisticId)
    if (!entry || sending) return
    setSending(true)
    setOptimisticMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? { ...m, pending: true, failed: false } : m))
    )
    await attemptSend(entry, entry.text, { type: entry.type, imageUrl: entry.imageUrl })
    setSending(false)
  }

  const visibleMessages = [...messages, ...optimisticMessages].filter(
    (message) => !uid || !(message.deletedFor || []).includes(uid)
  )

  return { messages: visibleMessages, loading, error, sending, sendMessage, retryMessage }
}
