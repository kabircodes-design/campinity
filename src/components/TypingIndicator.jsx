import { useEffect, useState } from 'react'
import { subscribeToTypingState } from '../firebase/chatService.js'
import { getProfilesByUids } from '../hooks/useAuthorEnrichment.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'

/**
 * Deliberately its own component, not inline in ChatPage — it owns its
 * own useState/useEffect so a typing flicker only ever re-renders this
 * small leaf, never ChatPage or the message list. Meant to be rendered
 * OUTSIDE the scrollable message <main> (a sibling row between it and
 * the composer), so its mount/unmount can never change that container's
 * scrollHeight — nothing to coordinate with the existing near-bottom/
 * auto-scroll logic, no scroll-jump risk by construction.
 *
 * Group-aware WHO-identity fix: subscribeToTypingState already returns
 * every currently-typing uid (the schema was already group-shaped — a
 * per-uid doc in chats/{chatId}/typing, not a single boolean), but this
 * component used to only ever have a NAME for the 1:1 case (ChatPage
 * only passes otherDisplayName when !isGroup) and never showed an
 * avatar at all — in a group, "Several people are typing..." with no
 * identity was the actual reported bug. Resolves typingUids -> profiles
 * itself via getProfilesByUids (the same shared, current-user-fresh
 * cache every other avatar consumer in the app now uses — no second
 * profile-fetch system), so it works identically for 1:1 and group
 * chats without ChatPage needing to hand it a member list.
 */
export default function TypingIndicator({ chatId, currentUid, otherDisplayName, otherPhotoUrl }) {
  const [typingUids, setTypingUids] = useState([])
  const [typingProfiles, setTypingProfiles] = useState(new Map())

  useEffect(() => {
    setTypingUids([])
    if (!chatId || !currentUid) return undefined
    const unsubscribe = subscribeToTypingState(chatId, currentUid, setTypingUids)
    return () => unsubscribe()
  }, [chatId, currentUid])

  useEffect(() => {
    if (typingUids.length === 0) return
    let cancelled = false
    getProfilesByUids(typingUids).then((profileByUid) => {
      if (!cancelled) setTypingProfiles(profileByUid)
    })
    return () => {
      cancelled = true
    }
  }, [typingUids])

  if (typingUids.length === 0) return null

  // 1:1 chats already hand this component the other participant's
  // name/photo directly (ChatPage already has it live via useChat's own
  // onSnapshot — no reason to re-fetch what's already in hand); group
  // chats fall back to the freshly-resolved typingProfiles map.
  const typers = typingUids.map((uid, i) => {
    if (i === 0 && otherDisplayName) {
      return { uid, displayName: otherDisplayName, photoUrl: otherPhotoUrl }
    }
    const profile = typingProfiles.get(uid)
    return {
      uid,
      displayName: profile?.displayName || 'Someone',
      photoUrl: profile ? getProfileIdentityImage(profile) : null
    }
  })

  const label =
    typers.length === 1
      ? `${typers[0].displayName} is typing`
      : typers.length === 2
        ? `${typers[0].displayName} and ${typers[1].displayName} are typing`
        : 'Several people are typing'

  const visibleTypers = typers.slice(0, 3)

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5 [animation:fadeIn_150ms_ease-out]">
      <div className="flex items-center -space-x-2 flex-shrink-0">
        {visibleTypers.map((typer) => (
          <span key={typer.uid} className="ring-2 ring-white rounded-full">
            <Avatar
              initials={getInitials(typer.displayName)}
              colorClass={getAvatarColor(typer.uid)}
              size="xs"
              src={typer.photoUrl || undefined}
            />
          </span>
        ))}
      </div>
      <span className="flex items-center gap-1.5 text-xs text-gray-400">
        {label}
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <span className="w-1 h-1 rounded-full bg-blue-400 [animation:typingDotBounce_1.2s_ease-in-out_infinite]" />
          <span className="w-1 h-1 rounded-full bg-blue-400 [animation:typingDotBounce_1.2s_ease-in-out_infinite_0.15s]" />
          <span className="w-1 h-1 rounded-full bg-blue-400 [animation:typingDotBounce_1.2s_ease-in-out_infinite_0.3s]" />
        </span>
      </span>
    </div>
  )
}
