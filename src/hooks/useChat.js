import { useEffect, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { getOrCreateChat, subscribeToChat } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

/**
 * Resolves and subscribes to a single chat's live state, and resolves
 * the other participant's profile for the chat header.
 *
 * `chatId` is expected in the deterministic "{uidA}_{uidB}" form (sorted
 * uids joined by '_' — see chatService.js's chatDocId). This hook
 * derives the other participant directly from that id and ensures the
 * chat document exists (creating it on first visit) before subscribing
 * — so navigating to /messages/{sorted uidA_uidB} always works as a
 * chat entry point, whether or not a conversation existed yet.
 */
export function useChat(chatId) {
  const [chat, setChat] = useState(null)
  const [otherProfile, setOtherProfile] = useState(null)
  const [otherUid, setOtherUid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let unsubscribe = null

    const uid = auth.currentUser?.uid
    const parts = (chatId || '').split('_')
    const resolvedOtherUid = parts.find((part) => part && part !== uid) || null

    if (!uid || !chatId || !resolvedOtherUid) {
      setError('Chat not found.')
      setLoading(false)
      return undefined
    }

    setOtherUid(resolvedOtherUid)

    const setup = async () => {
      try {
        await getOrCreateChat(uid, resolvedOtherUid)
        if (cancelled) return

        const profile = await getUserProfile(resolvedOtherUid).catch(() => null)
        if (!cancelled) setOtherProfile(profile)

        unsubscribe = subscribeToChat(
          chatId,
          (data) => {
            if (!cancelled) {
              setChat(data)
              setLoading(false)
            }
          },
          () => {
            if (!cancelled) {
              setError('Could not load this chat.')
              setLoading(false)
            }
          }
        )
      } catch {
        if (!cancelled) {
          setError('Could not load this chat.')
          setLoading(false)
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [chatId])

  return { chat, otherProfile, otherUid, loading, error }
}