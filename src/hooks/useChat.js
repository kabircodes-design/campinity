import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase.js'
import { subscribeToChat, getOrCreateChat, getChat } from '../firebase/chatService.js'
import { mapProfileDoc } from '../firebase/profileService.js'

const DEBUG_CHAT_FLOW = import.meta.env.DEV

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

    let cancelled = false
    let notFoundRetries = 0
    setLoading(true)
    setError('')

    if (DEBUG_CHAT_FLOW) console.debug('[CHAT READ] subscribing', { chatId, uid })

    const unsubscribe = subscribeToChat(
      chatId,
      uid,
      async (data) => {
        if (cancelled) return

        if (!data) {
          // getOrCreateChat() is always awaited before navigate() ever
          // fires, so by the time this listener attaches, the document
          // is durably committed server-side — a live listener's very
          // FIRST event reporting "not found" right after creation is
          // the listener catching up to a recent write, not a genuine
          // deletion. Confirm with one direct server read (getChat,
          // getDoc — not the cached listener) before ever showing the
          // terminal "no longer exists" message, so that message can
          // ONLY appear for a chat that is actually, verifiably gone.
          if (notFoundRetries < 3) {
            notFoundRetries += 1
            if (DEBUG_CHAT_FLOW) console.debug('[CHAT READ] snapshot reported not-found, verifying directly', { chatId, attempt: notFoundRetries })
            const verified = await getChat(chatId, uid).catch((err) => {
              if (DEBUG_CHAT_FLOW) console.debug('[CHAT READ] verification read failed', { chatId, code: err?.code, message: err?.message })
              return undefined
            })
            if (cancelled) return
            if (verified) {
              if (DEBUG_CHAT_FLOW) console.debug('[CHAT READ] verified chat actually exists — ignoring stale not-found event', { chatId })
              return // real doc exists; the live listener will deliver it shortly
            }
          }
          if (DEBUG_CHAT_FLOW) console.debug('[CHAT READ] confirmed not-found after verification', { chatId })
          setError('This conversation no longer exists.')
          setLoading(false)
          return
        }

        notFoundRetries = 0
        if (DEBUG_CHAT_FLOW) console.debug('[CHAT READ] loaded', { chatId, status: data.status, requestedBy: data.requestedBy, participants: data.participants, pendingMessageCount: data.pendingMessageCount })
        setChatData(data)
        setLoading(false)
      },
      (err) => {
        if (cancelled) return
        console.error('[CHAT READ] listener error', { chatId, uid, code: err?.code, message: err?.message })
        // Never let a permission/network/availability error masquerade
        // as "this conversation no longer exists" — that message is
        // reserved for a verified-absent document (the branch above).
        if (err?.code === 'permission-denied') {
          setError("You don't have access to this conversation.")
        } else if (err?.code === 'unavailable' || err?.code === 'deadline-exceeded') {
          setError('Connection issue — check your internet and try again.')
        } else {
          setError(err?.message || 'Could not load this conversation.')
        }
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [chatId, uid])

  // Live subscription, not a one-time fetch — presence (lastActiveAt)
  // must update in real time while the conversation is open, not just
  // reflect whatever was true the moment the chat was opened.
  useEffect(() => {
    if (!chatData?.otherUid) return undefined
    const unsubscribe = onSnapshot(
      doc(db, 'users', chatData.otherUid),
      (snap) => setOtherProfile(snap.exists() ? mapProfileDoc(snap.data()) : null),
      () => {}
    )
    return unsubscribe
  }, [chatData?.otherUid])

  return { chat: chatData, otherProfile, otherUid: chatData?.otherUid || null, loading, error }
}

/** Entry point for starting/opening a conversation from a profile's Message button — not used by ChatPage.jsx itself, which expects an existing chatId, but needed somewhere to actually produce one. */
export async function openChatWith(otherUid) {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You need to be signed in to message someone.')
  return getOrCreateChat(uid, otherUid)
}
