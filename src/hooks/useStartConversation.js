import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrCreateChat } from '../firebase/chatService.js'
import { useMyVerification } from '../access/useMyVerification.js'

/**
 * Shared by every "Message this person" entry point outside
 * StudentProfilePlaceholder.jsx (which set the original pattern this
 * hook now centralizes: Profile, Radar, Stories, Marketplace, Lost &
 * Found all had their own separate getOrCreateChat call sites with no
 * shared verification check — this is what closes that gap without
 * repeating the same busy/error/gate boilerplate five more times.
 *
 * `hasExistingChat` lets a caller that already knows a chat/request
 * exists (same idea as StudentProfilePlaceholder's own messageState)
 * skip the gate — reopening an existing conversation must keep working
 * regardless of CURRENT verification status; only starting a genuinely
 * NEW one is restricted. Callers that can't cheaply know this in
 * advance (Radar, Stories, a Marketplace seller card) simply omit it —
 * getOrCreateChat's own first step already resolves whether a chat
 * exists before ever attempting a create, so the real security boundary
 * (chats/{chatId}'s create rule in firestore.rules) is unaffected
 * either way; this option only controls whether the UI shows a gate
 * pre-emptively or lets the (still real) rule reject it.
 */
export function useStartConversation() {
  const navigate = useNavigate()
  const verified = useMyVerification()
  const [gateOpen, setGateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const startConversation = async (currentUid, otherUid, { hasExistingChat = false } = {}) => {
    if (!currentUid || !otherUid || busy) return
    if (!hasExistingChat && verified === false) {
      setGateOpen(true)
      return
    }
    setError('')
    setBusy(true)
    try {
      const { chatId } = await getOrCreateChat(currentUid, otherUid)
      navigate(`/messages/${chatId}`)
    } catch (err) {
      setError(err?.message || 'Could not open this conversation. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return { startConversation, verified, gateOpen, setGateOpen, busy, error, clearError: () => setError('') }
}
