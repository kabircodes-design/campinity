import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Check, Link as LinkIcon, Send, RotateCcw } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
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
 */
export default function ShareBottomSheet({ open, onClose, referenceType, referenceId, preview }) {
  const currentUid = auth.currentUser?.uid
  const [currentUserProfile, setCurrentUserProfile] = useState(null)

  const { recentChats, recentLoading, searchTerm, setSearchTerm, searchResults, searchLoading, isSearching } =
    useShareRecipients(currentUid)

  const [selectedUsers, setSelectedUsers] = useState([]) // full user objects, not just uids — needed to render chips without a lookup
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [allSent, setAllSent] = useState(false)
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  // Per-recipient status, for "sending / sent / failed" + retry —
  // Map<uid, 'sending' | 'sent' | 'failed'>
  const [recipientStatus, setRecipientStatus] = useState({})

  useEffect(() => {
    if (!open || !currentUid) return
    getUserProfile(currentUid).then(setCurrentUserProfile).catch(() => {})
  }, [open, currentUid])

  useEffect(() => {
    if (!open) {
      setSelectedUsers([])
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

  const toggleRecipient = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.uid === user.uid) ? prev.filter((u) => u.uid !== user.uid) : [...prev, user]
    )
  }

  const removeChip = (uid) => {
    setSelectedUsers((prev) => prev.filter((u) => u.uid !== uid))
  }

  const performSend = async (usersToSend) => {
    if (usersToSend.length === 0) return
    setSending(true)
    setError('')
    setRecipientStatus((prev) => {
      const next = { ...prev }
      usersToSend.forEach((u) => {
        next[u.uid] = 'sending'
      })
      return next
    })

    try {
      const { succeeded, failedCount } = await shareContentToRecipients({
        currentUid,
        currentUserProfile,
        recipientUids: usersToSend.map((u) => u.uid),
        type: `shared_${referenceType}`,
        referenceId,
        referenceType,
        preview,
        message: messageText
      })

      const succeededUids = new Set(succeeded.map((s) => s.recipientUid))
      setRecipientStatus((prev) => {
        const next = { ...prev }
        usersToSend.forEach((u) => {
          next[u.uid] = succeededUids.has(u.uid) ? 'sent' : 'failed'
        })
        return next
      })

      if (failedCount === 0) {
        setAllSent(true)
        window.setTimeout(onClose, 900)
      } else if (failedCount === usersToSend.length) {
        setError('Could not send — tap retry on a recipient below.')
      } else {
        setError('Some messages failed to send — tap retry below.')
      }
    } catch (err) {
      setRecipientStatus((prev) => {
        const next = { ...prev }
        usersToSend.forEach((u) => {
          next[u.uid] = 'failed'
        })
        return next
      })
      setError(err?.message || 'Could not send — please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => performSend(selectedUsers)

  const handleRetry = (user) => performSend([user])

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

  const listToShow = isSearching ? searchResults : recentChats
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

        {selectedUsers.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto scroll-hidden">
            {selectedUsers.map((user) => (
              <span
                key={user.uid}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 pl-1.5 pr-2.5 py-1 text-xs font-medium"
              >
                <Avatar initials={getInitials(user.displayName)} colorClass={getAvatarColor(user.uid)} size="sm" src={user.avatar || undefined} />
                {user.displayName}
                <button type="button" onClick={() => removeChip(user.uid)} aria-label={`Remove ${user.displayName}`}>
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
              const uid = item.otherUid || item.uid
              const displayName = item.displayName || 'Student'
              const user = { uid, displayName, username: item.username, avatar: item.avatar }
              const isSelected = selectedUsers.some((u) => u.uid === uid)
              const status = recipientStatus[uid]

              return (
                <button
                  key={uid}
                  type="button"
                  onClick={() => toggleRecipient(user)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  <div className="relative">
                    <Avatar initials={getInitials(displayName)} colorClass={getAvatarColor(uid)} size="md" src={item.avatar || undefined} />
                    {isSelected && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    {item.username && <p className="text-[11px] text-gray-400 truncate">@{item.username}</p>}
                  </div>
                  {status === 'sending' && <span className="text-[11px] text-gray-400">Sending...</span>}
                  {status === 'sent' && <Check className="w-4 h-4 text-emerald-500" />}
                  {status === 'failed' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRetry(user)
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
                  onClick={() => performSend(selectedUsers.filter((u) => recipientStatus[u.uid] === 'failed'))}
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
            disabled={selectedUsers.length === 0 || sending || allSent}
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
                Send{selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ''}
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
