import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Pin, Users, VolumeX } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials, formatTimeAgo } from '../firebase/postService.js'
import { auth } from '../firebase/firebase.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { isOnline } from '../firebase/presenceService.js'
import { deleteChat, markChatRead, markChatUnread, toggleMuteChat } from '../firebase/chatService.js'
import ChatActionSheet from './ChatActionSheet.jsx'
import { useAuthorProfile } from '../hooks/useAuthorEnrichment.js'

const LONG_PRESS_MS = 500

/**
 * Props match MessagesPage.jsx's usage: <ChatCard chat={chat}
 * profile={profiles[chat.otherUid]} />. profile can be undefined
 * briefly (MessagesPage.jsx fetches profiles asynchronously after the
 * chat list arrives) — handled with a "Student" fallback, not a crash.
 *
 * Group branch added — chat.type === 'group' uses groupName/
 * groupAvatar/participants.length directly from the chat document
 * itself (no profile lookup needed, unlike 1-to-1). The 1-to-1 path
 * below this check is byte-for-byte the same as before.
 *
 * Contextual actions (delete/mute/mark unread) are self-contained here
 * — long-press (mobile), right-click (desktop), or the row's own "..."
 * button all open the same ChatActionSheet, and this component owns
 * its own chatService calls directly rather than threading handlers
 * through ChatListPanel/MessagesPage, since every action only ever
 * needs this one chat's id and the current uid, both already in scope.
 */
export default function ChatCard({ chat, profile }) {
  const navigate = useNavigate()
  const uid = auth.currentUser?.uid
  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const longPressTimerRef = useRef(null)
  const suppressClickRef = useRef(false)

  const isGroup = chat.type === 'group'
  const displayName = isGroup ? chat.groupName || 'Group' : profile?.displayName || 'Student'
  const subtitle = isGroup ? `${chat.participants?.length || 0} members` : null
  const isPinned = (chat.pinnedBy || []).includes(uid)
  const isMuted = (chat.mutedBy || []).includes(uid)
  // Real per-message unread COUNT (chatService.js's sendMessage
  // increments unreadCount.{uid} for every other participant, and
  // markChatRead/markChatUnread reset it) — not just the old readBy
  // read/unread boolean, which could never say "how many," only
  // "any." isUnread now derives from the same real number instead of
  // a separately-maintained flag, so the two can't disagree.
  const unreadCount = chat.unreadCount?.[uid] || 0
  const isUnread = unreadCount > 0
  const unreadLabel = unreadCount > 9 ? '9+' : String(unreadCount)
  const online = !isGroup && isOnline(profile)

  // Smart group preview — "Rahul: Hey, are we meeting today?" instead of
  // a bare message with no sender identity, which is the actual reason
  // a busy group's list becomes hard to scan. Only fetched for groups
  // (1:1 has no ambiguity about who sent it), and reuses the same
  // shared/deduped author cache every other avatar/name consumer in the
  // app now uses — not a new lookup system.
  const lastSenderIsMe = chat.lastSenderId === uid
  const lastSenderProfile = useAuthorProfile(isGroup && chat.lastSenderId && !lastSenderIsMe ? chat.lastSenderId : null)
  const groupPreviewPrefix = isGroup && chat.lastMessage ? (lastSenderIsMe ? 'You: ' : lastSenderProfile ? `${lastSenderProfile.displayName?.split(' ')[0] || 'Someone'}: ` : '') : ''

  const openSheet = () => setSheetOpen(true)

  const handleTouchStart = () => {
    suppressClickRef.current = false
    longPressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      if (navigator.vibrate) navigator.vibrate(10) // subtle tactile confirmation, matches the brief's "subtle tactile/contextual response"
      openSheet()
    }, LONG_PRESS_MS)
  }
  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }
  const handleClick = (event) => {
    if (suppressClickRef.current) {
      // The long-press already opened the sheet — the browser's own
      // synthesized click that follows touchend must not ALSO navigate
      // into the chat underneath the sheet that's now open.
      event.preventDefault()
      suppressClickRef.current = false
      return
    }
    navigate(`/messages/${chat.id}`)
  }
  const handleContextMenu = (event) => {
    event.preventDefault() // desktop right-click — same sheet, not the OS/browser context menu
    openSheet()
  }

  const handleToggleMute = async () => {
    setSheetOpen(false)
    if (!uid) return
    toggleMuteChat(chat.id, uid).catch(() => {})
  }

  const handleToggleRead = async () => {
    setSheetOpen(false)
    if (!uid) return
    const action = isUnread ? markChatRead(chat.id, uid) : markChatUnread(chat.id, uid)
    action.catch(() => {})
  }

  const handleDelete = async () => {
    if (busy || !uid) return
    setBusy(true)
    try {
      await deleteChat(chat.id, uid)
      setConfirmingDelete(false)
      setSheetOpen(false)
    } catch {
      // Left open on failure — same "stay put, let the user retry" as
      // the rest of this app's confirm dialogs rather than silently
      // closing on an action that didn't actually happen.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative group/row">
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
        onContextMenu={handleContextMenu}
        className="w-full flex items-center gap-3 pl-4 pr-11 py-3 text-left hover:bg-gray-50 transition-all duration-200"
      >
        <div className="relative flex-shrink-0">
          {isGroup ? (
            chat.groupAvatar ? (
              <img src={chat.groupAvatar} alt="" className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
            )
          ) : (
            <Avatar
              initials={getInitials(displayName)}
              colorClass={getAvatarColor(chat.otherUid || chat.id)}
              size="md"
              src={getProfileIdentityImage(profile) || undefined}
            />
          )}
          {online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" aria-label="Online" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
              {displayName}
            </p>
            {isPinned && <Pin className="w-3 h-3 text-gray-300 flex-shrink-0" fill="currentColor" />}
            {isMuted && <VolumeX className="w-3 h-3 text-gray-300 flex-shrink-0" />}
          </div>
          {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
          <p className={`text-xs truncate ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {chat.isPendingSent ? (
              'Message Request Sent'
            ) : chat.lastMessage ? (
              <>
                {groupPreviewPrefix && <span className="text-gray-500">{groupPreviewPrefix}</span>}
                {chat.lastMessage}
              </>
            ) : (
              'Say hello 👋'
            )}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[11px] text-gray-400">{formatTimeAgo(chat.lastMessageAt)}</span>
          {isUnread && (
            <span
              className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center"
              aria-label={`${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`}
            >
              {unreadLabel}
            </span>
          )}
        </div>
      </button>

      {/* Always-reachable equivalent to long-press/right-click — subtle
          on mobile, hover-revealed on desktop (group/row + opacity), per
          the brief's explicit "don't make long-press the only way in." */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          openSheet()
        }}
        aria-label="Chat options"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-70 lg:opacity-0 lg:group-hover/row:opacity-100 transition-all duration-200"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {sheetOpen && !confirmingDelete && (
        <ChatActionSheet
          chat={chat}
          isUnread={isUnread}
          isMuted={isMuted}
          onClose={() => setSheetOpen(false)}
          onToggleMute={handleToggleMute}
          onToggleRead={handleToggleRead}
          onDelete={() => setConfirmingDelete(true)}
        />
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => !busy && setConfirmingDelete(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 [animation:modalIn_200ms_cubic-bezier(0.16,1,0.3,1)]">
            <p className="text-sm font-semibold text-gray-900">Delete this chat?</p>
            <p className="mt-1.5 text-sm text-gray-400">
              It'll disappear from your chat list. {chat.type === 'group' ? 'Other members' : 'The other person'} won't be
              affected — if a new message comes in, it'll reappear.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
