import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, Link as LinkIcon, Send, RotateCcw, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getUserProfile } from '../firebase/profileService.js'
import { useShareRecipients } from './useShareRecipients.js'
import { shareContentToRecipients } from './shareService.js'
import { getCanonicalUrl } from './shareTypes.js'
import ExternalShareRow from './ExternalShareRow.jsx'

/**
 * Root cause of "share button pops the bottom nav, no overlay opens":
 * this component is rendered inside PostCard.jsx, which lives inside
 * every page's SwipeablePage wrapper — a Framer Motion <motion.div>
 * with an active transform (animate={{ x: dragX }}) and
 * willChange: 'transform', both of which independently create a new
 * CSS stacking context. A position:fixed descendant of a transformed
 * ancestor is fixed to THAT ancestor's containing block, not the
 * viewport — so this sheet was rendering, just trapped and invisible
 * inside the page wrapper, while BottomNav (outside that wrapper)
 * stayed on top. Fixed via createPortal straight to document.body,
 * the standard escape hatch for exactly this problem — verified by
 * reading SwipeablePage.jsx directly, not guessed at.
 *
 * Group-chat support: recentChats (from useShareRecipients) can now
 * contain group chat documents alongside 1-to-1 ones — a group has no
 * uid (it's not a person), it has a chatId (the chat already exists).
 * normalizeItem below produces one consistent shape for both kinds so
 * selection/rendering/sending don't need type-checks scattered
 * everywhere; recipient.key is what selection state tracks (a group's
 * chatId or a user's uid — always unique, never undefined), and
 * building the actual { type, uid } / { type, chatId } shape
 * shareContentToRecipients expects happens in one place (buildRecipient
 * below), not duplicated at each call site.
 */

function normalizeItem(item) {
  if (item.type === 'group') {
    return {
      key: item.id,
      kind: 'group',
      chatId: item.id,
      displayName: item.groupName || 'Group',
      username: null,
      avatar: item.groupAvatar || '',
      memberCount: item.participants?.length || 0
    }
  }
  // 1-to-1 chat (has otherUid, enriched with displayName/avatar/username
  // by useShareRecipients.js) or a search result (already this exact
  // shape from searchUsersForShare) — both are "kind: user".
  const uid = item.otherUid || item.uid
  return {
    key: uid,
    kind: 'user',
    uid,
    displayName: item.displayName || 'Student',
    username: item.username || null,
    avatar: getProfileIdentityImage(item) || item.avatar || '',
    memberCount: null
  }
}

function buildRecipient(selection) {
  return selection.kind === 'group' ? { type: 'group', chatId: selection.chatId } : { type: 'user', uid: selection.uid }
}

export default function ShareBottomSheet({ open, onClose, referenceType, referenceId, preview }) {
  const currentUid = auth.currentUser?.uid
  const [currentUserProfile, setCurrentUserProfile] = useState(null)

  const { recentChats, recentLoading, searchTerm, setSearchTerm, searchResults, searchLoading, isSearching } =
    useShareRecipients(currentUid)

  const [selectedRecipients, setSelectedRecipients] = useState([]) // normalized items, keyed by .key
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [allSent, setAllSent] = useState(false)
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  // Per-recipient status, keyed by the same .key used for selection —
  // 'sending' | 'sent' | 'failed'
  const [recipientStatus, setRecipientStatus] = useState({})

  useEffect(() => {
    if (!open || !currentUid) return
    getUserProfile(currentUid).then(setCurrentUserProfile).catch(() => {})
  }, [open, currentUid])

  useEffect(() => {
    if (!open) {
      setSelectedRecipients([])
      setMessageText('')
      setAllSent(false)
      setError('')
      setSearchTerm('')
      setRecipientStatus({})
    }
  }, [open, setSearchTerm])

  // Body scroll lock while the sheet is open — a real mobile-viewport
  // fix: without this, dragging inside the sheet on a touch device can
  // scroll the page underneath it at the same time.
  useEffect(() => {
    if (!open) return undefined
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Escape key closes — real keyboard handling, not just tap-outside.
  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const toggleRecipient = (item) => {
    setSelectedRecipients((prev) =>
      prev.some((r) => r.key === item.key) ? prev.filter((r) => r.key !== item.key) : [...prev, item]
    )
  }

  const removeChip = (key) => {
    setSelectedRecipients((prev) => prev.filter((r) => r.key !== key))
  }

  const performSend = async (itemsToSend) => {
    if (itemsToSend.length === 0) return
    setSending(true)
    setError('')
    setRecipientStatus((prev) => {
      const next = { ...prev }
      itemsToSend.forEach((item) => {
        next[item.key] = 'sending'
      })
      return next
    })

    try {
      const { succeeded, failedCount } = await shareContentToRecipients({
        currentUid,
        currentUserProfile,
        recipients: itemsToSend.map(buildRecipient),
        type: `shared_${referenceType}`,
        referenceId,
        referenceType,
        preview,
        message: messageText
      })

      // succeeded entries carry back { recipient, chatId } — recipient
      // is the same { type, uid } / { type, chatId } shape sent in, so
      // matching back to itemsToSend's .key works for both kinds.
      const succeededKeys = new Set(
        succeeded.map((s) => (s.recipient.type === 'group' ? s.recipient.chatId : s.recipient.uid))
      )
      setRecipientStatus((prev) => {
        const next = { ...prev }
        itemsToSend.forEach((item) => {
          next[item.key] = succeededKeys.has(item.key) ? 'sent' : 'failed'
        })
        return next
      })

      if (failedCount === 0) {
        setAllSent(true)
        window.setTimeout(onClose, 900)
      } else if (failedCount === itemsToSend.length) {
        setError('Could not send — tap retry on a recipient below.')
      } else {
        setError('Some messages failed to send — tap retry below.')
      }
    } catch (err) {
      setRecipientStatus((prev) => {
        const next = { ...prev }
        itemsToSend.forEach((item) => {
          next[item.key] = 'failed'
        })
        return next
      })
      setError(err?.message || 'Could not send — please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => performSend(selectedRecipients)

  const handleRetry = (item) => performSend([item])

  const handleCopyLink = async () => {
    const path = getCanonicalUrl(referenceType, referenceId)
    if (!path) return
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1500)
    } catch {
      // Clipboard API unavailable on this device/context — silent no-op, ExternalShareRow's links still work independently.
    }
  }

  const rawList = isSearching ? searchResults : recentChats
  const listToShow = rawList.map(normalizeItem)
  const isListLoading = isSearching ? searchLoading : recentLoading
  const anyFailed = Object.values(recipientStatus).includes('failed')

  const sheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
      />

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose()
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="relative w-full max-w-[480px] lg:max-w-[520px] bg-white rounded-t-3xl max-h-[85vh] flex flex-col touch-none"
      >
        <div className="flex justify-center pt-2.5 pb-1 touch-none">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-4 pt-1 pb-2">
          <span className="text-base font-bold text-gray-900">Share</span>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all duration-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2.5">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search people..."
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
            />
          </div>
        </div>

        {selectedRecipients.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto scroll-hidden">
            {selectedRecipients.map((item) => (
              <span
                key={item.key}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 pl-1.5 pr-2.5 py-1 text-xs font-medium"
              >
                {item.kind === 'group' ? (
                  item.avatar ? (
                    <img src={item.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                      <Users className="w-3 h-3 text-white" />
                    </span>
                  )
                ) : (
                  <Avatar initials={getInitials(item.displayName)} colorClass={getAvatarColor(item.key)} size="sm" src={item.avatar || undefined} />
                )}
                {item.displayName}
                <button type="button" onClick={() => removeChip(item.key)} aria-label={`Remove ${item.displayName}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="px-4 pb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 transition-all duration-200"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            {linkCopied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>

        <ExternalShareRow referenceType={referenceType} referenceId={referenceId} preview={preview} />

        <p className="px-4 pt-2 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {isSearching ? 'Search Results' : 'Recent Chats'}
        </p>

        <div className="flex-1 overflow-y-auto px-2 pb-2 touch-pan-y">
          {isListLoading ? (
            <div className="space-y-1 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                    <div className="h-2 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : listToShow.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {isSearching ? 'No one found.' : 'No recent chats yet.'}
            </p>
          ) : (
            listToShow.map((item) => {
              const isSelected = selectedRecipients.some((r) => r.key === item.key)
              const status = recipientStatus[item.key]

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleRecipient(item)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  <div className="relative">
                    {item.kind === 'group' ? (
                      item.avatar ? (
                        <img src={item.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                          <Users className="w-4 h-4 text-white" />
                        </div>
                      )
                    ) : (
                      <Avatar initials={getInitials(item.displayName)} colorClass={getAvatarColor(item.key)} size="md" src={item.avatar || undefined} />
                    )}
                    {isSelected && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.displayName}</p>
                    {item.kind === 'group' ? (
                      <p className="text-[11px] text-gray-400 truncate">{item.memberCount} members</p>
                    ) : (
                      item.username && <p className="text-[11px] text-gray-400 truncate">@{item.username}</p>
                    )}
                  </div>
                  {status === 'sending' && <span className="text-[11px] text-gray-400">Sending...</span>}
                  {status === 'sent' && <Check className="w-4 h-4 text-emerald-500" />}
                  {status === 'failed' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRetry(item)
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-red-500"
                    >
                      <RotateCcw className="w-3 h-3" /> Retry
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5">
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              {error}
              {anyFailed && (
                <button
                  type="button"
                  onClick={() => performSend(selectedRecipients.filter((r) => recipientStatus[r.key] === 'failed'))}
                  className="font-semibold underline"
                >
                  Retry all failed
                </button>
              )}
            </p>
          )}
          <input
            type="text"
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Add a message..."
            disabled={sending || allSent}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 transition-all duration-300"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={selectedRecipients.length === 0 || sending || allSent}
            className="w-full flex items-center justify-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
          >
            {allSent ? (
              <>
                <Check className="w-4 h-4" /> Sent
              </>
            ) : sending ? (
              'Sending...'
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send{selectedRecipients.length > 0 ? ` (${selectedRecipients.length})` : ''}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )

  return createPortal(
    <AnimatePresence>{open && sheet}</AnimatePresence>,
    document.body
  )
}
