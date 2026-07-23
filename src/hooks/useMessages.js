import { useEffect, useRef, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { markChatRead, sendMessage as sendMessageToChat, subscribeToMessages } from '../firebase/chatService.js'

/**
 * Subscribes to a chat's messages in real time and exposes a
 * sendMessage function with optimistic local insertion (the sent bubble
 * appears instantly; the realtime listener's next snapshot replaces the
 * optimistic entry with the server-confirmed message automatically,
 * since each snapshot replaces the whole list rather than merging).
 *
 * Marks the chat read (for the current user, against `otherUid`) every
 * time a fresh snapshot arrives while this hook is mounted — i.e.
 * whenever the user has the chat open and a new message comes in.
 */
export function useMessages(chatId, otherUid) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const optimisticIdRef = useRef(0)

  useEffect(() => {
    if (!chatId) return undefined
    let cancelled = false

    const unsubscribe = subscribeToMessages(
      chatId,
      (data) => {
        if (cancelled) return
        setMessages(data)
        setLoading(false)

        const uid = auth.currentUser?.uid
        if (uid && otherUid) markChatRead(chatId, uid, otherUid).catch(() => {})
      },
      () => {
        if (!cancelled) {
          setError('Could not load messages.')
          setLoading(false)
        }
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [chatId, otherUid])

  const sendMessage = async (text) => {
    const trimmed = (text || '').trim()
    const uid = auth.currentUser?.uid
    if (!trimmed || !uid || !otherUid || !chatId || sending) return

    optimisticIdRef.current += 1
    const optimisticId = `optimistic-${optimisticIdRef.current}`
    const optimisticMessage = {
      id: optimisticId,
      senderId: uid,
      text: trimmed,
      createdAt: null,
      read: false,
      pending: true
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setSending(true)
    setError('')

    try {
      await sendMessageToChat(chatId, uid, otherUid, trimmed)
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticId))
      setError('Message failed to send.')
    } finally {
      setSending(false)
    }
  }

  return { messages, loading, error, sending, sendMessage }
}