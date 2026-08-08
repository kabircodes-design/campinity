import { useEffect, useRef, useState } from 'react'
import { subscribeToUserChats } from '../firebase/chatService.js'
import { searchUsersForShare, getUserProfile } from '../firebase/profileService.js'

/**
 * Recent chats load instantly and stay visible above search results
 * while typing — recent chats are a live subscription (already
 * ordered by lastMessageAt, reused from chatService.js, not
 * reimplemented), search results are a debounced query layered on
 * top. Two separate lists, not merged into one array, so the UI can
 * render "Recent Chats" and "Search Results" as distinct sections per
 * the spec rather than guessing which list an item belongs to.
 *
 * Profile enrichment (the actual "Student" bug fix): subscribeToUserChats
 * only returns chat-document fields plus a computed otherUid — it was
 * never going to have displayName/avatar, those live on users/{uid}.
 * MessagesPage.jsx already does a separate per-chat profile fetch for
 * exactly this reason; this hook previously didn't, which is why every
 * recent chat fell through to ShareBottomSheet's "Student" fallback.
 * Same fetch-and-cache pattern as MessagesPage.jsx now, not a new one.
 */
export function useShareRecipients(currentUid) {
  const [recentChats, setRecentChats] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [profiles, setProfiles] = useState({})
  const fetchedUidsRef = useRef(new Set())

  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (!currentUid) return undefined
    const unsubscribe = subscribeToUserChats(currentUid, (chats) => {
      // Pinned chats first, per "pinned chats, active chats — exactly
      // like Instagram" — real data (chat.pinnedBy), not a fake
      // "active now" signal (which would need presence infrastructure
      // this project doesn't have, same gap already flagged for the
      // messaging system's online/typing indicators).
      const sorted = [...chats].sort((a, b) => {
        const aPinned = (a.pinnedBy || []).includes(currentUid)
        const bPinned = (b.pinnedBy || []).includes(currentUid)
        if (aPinned !== bPinned) return aPinned ? -1 : 1
        return 0 // already ordered by lastMessageAt from the subscription itself
      })
      setRecentChats(sorted)
      setRecentLoading(false)

      sorted.forEach((chat) => {
        if (!chat?.otherUid || fetchedUidsRef.current.has(chat.otherUid)) return
        fetchedUidsRef.current.add(chat.otherUid)
        getUserProfile(chat.otherUid)
          .then((profile) => {
            if (profile) setProfiles((prev) => ({ ...prev, [chat.otherUid]: profile }))
          })
          .catch(() => {})
      })
    })
    return unsubscribe
  }, [currentUid])

  // Merge each chat with its resolved profile — this is what
  // ShareBottomSheet.jsx's item.displayName / item.avatar / item.username
  // now actually reads from, instead of fields that never existed on
  // the raw chat document. If a profile genuinely can't be resolved
  // (deleted account, a fetch failure), displayName/avatar/username
  // simply stay absent here too — ShareBottomSheet's own "Student"
  // fallback still applies, but now only for a real resolution
  // failure, not for every single chat unconditionally.
  const enrichedRecentChats = recentChats.map((chat) => {
    const profile = profiles[chat.otherUid]
    return profile
      ? { ...chat, displayName: profile.displayName, username: profile.username, avatar: profile.avatar }
      : chat
  })

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([])
      setSearchLoading(false)
      return undefined
    }
    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      searchUsersForShare(searchTerm, currentUid)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchTerm, currentUid])

  return {
    recentChats: enrichedRecentChats,
    recentLoading,
    searchTerm,
    setSearchTerm,
    searchResults,
    searchLoading,
    isSearching: Boolean(searchTerm.trim())
  }
}
