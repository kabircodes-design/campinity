import { useEffect, useState } from 'react'
import { subscribeToUserChats } from '../firebase/chatService.js'
import { searchUsersForShare } from '../firebase/profileService.js'

/**
 * Recent chats load instantly and stay visible above search results
 * while typing — recent chats are a live subscription (already
 * ordered by lastMessageAt, reused from chatService.js, not
 * reimplemented), search results are a debounced query layered on
 * top. Two separate lists, not merged into one array, so the UI can
 * render "Recent Chats" and "Search Results" as distinct sections per
 * the spec rather than guessing which list an item belongs to.
 */
export function useShareRecipients(currentUid) {
  const [recentChats, setRecentChats] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)

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
    })
    return unsubscribe
  }, [currentUid])

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
    recentChats,
    recentLoading,
    searchTerm,
    setSearchTerm,
    searchResults,
    searchLoading,
    isSearching: Boolean(searchTerm.trim())
  }
}
