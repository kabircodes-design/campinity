import { useEffect, useState } from 'react'
import { auth } from '../firebase/firebase.js'
import { subscribeToChat, getOrCreateChat } from '../firebase/chatService.js'
import { getUserProfile } from '../firebase/profileService.js'

/**
 * Resolves a chat's metadata + the other participant's live profile.
 * Return shape matches ChatPage.jsx's actual destructuring exactly:
 * { otherProfile, otherUid, loading, error }.
 *
 * chatId here is expected to already be the deterministic
 * "{uidA}_{uidB}" id (how MessagesPage.jsx's chat list and any
 * "message this person" entry point would navigate here) — this hook
 * subscribes to that chat directly rather than re-deriving it, since
 * getOrCreateChat is the entry-point-time decision (request vs.
 * direct), not something to re-run on every chat screen open.
 */
export function useChat(chatId) {
  const [chatData, setChatData] = useState(null)
  const [otherProfile, setOtherProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const uid = auth.currentUser?.uid

  useEffect(() => {
    if (!chatId || !uid) {
      setError('Not signed in.')
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError('')

    const unsubscribe = subscribeToChat(
      chatId,
      uid,
      (data) => {
        if (!data) {
          setError('This conversation no longer exists.')
          setLoading(false)
          return
        }
        setChatData(data)
        setLoading(false)
      },
      (err) => {
        setError(err?.message || 'Could not load this conversation.')
        setLoading(false)
      }
    )

    return unsubscribe
  }, [chatId, uid])

  useEffect(() => {
    if (!chatData?.otherUid) return
    let cancelled = false
    getUserProfile(chatData.otherUid)
      .then((profile) => {
        if (!cancelled) setOtherProfile(profile)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [chatData?.otherUid])

  return { chat: chatData, otherProfile, otherUid: chatData?.otherUid || null, loading, error }
}

/** Entry point for starting/opening a conversation from a profile's Message button — not used by ChatPage.jsx itself, which expects an existing chatId, but needed somewhere to actually produce one. */
export async function openChatWith(otherUid) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You need to be signed in to message someone.')
  return getOrCreateChat(uid, otherUid)
}
