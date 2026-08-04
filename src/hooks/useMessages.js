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
      // Drop any optimistic entry now confirmed by a real, persisted
      // message with the same sender + text.
      setOptimisticMessages((prev) =>
        prev.filter(
          (optimistic) => !data.some((real) => real.senderId === optimistic.senderId && real.text === optimistic.text)
        )
      )
    })

    return unsubscribe
  }, [chatId])

  useEffect(() => {
    if (!chatId || !uid) return
    markChatRead(chatId, uid).catch(() => {})
  }, [chatId, uid])

  const sendMessage = async (text) => {
    if (!chatId || !uid || !text?.trim()) return
    setSending(true)
    setError('')

    const optimisticEntry = {
      id: `optimistic-${Date.now()}`,
      senderId: uid,
      text: text.trim(),
      read: false,
      edited: false,
      deletedFor: [],
      pending: true,
      createdAt: null
    }
    setOptimisticMessages((prev) => [...prev, optimisticEntry])

    try {
      await sendMessageToFirestore(chatId, uid, text)
    } catch (err) {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticEntry.id))
      setError(err?.message || 'Could not send this message.')
    } finally {
      setSending(false)
    }
  }

  const visibleMessages = [...messages, ...optimisticMessages].filter(
    (message) => !uid || !(message.deletedFor || []).includes(uid)
  )

  return { messages: visibleMessages, loading, error, sending, sendMessage }
}
