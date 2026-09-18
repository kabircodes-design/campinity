import { Bell, BellOff, CircleDot, MailOpen, Trash2, X } from 'lucide-react'

/**
 * Shared bottom-sheet (mobile) / centered card (desktop) for a chat
 * row's contextual actions — reachable via long-press, right-click, or
 * the row's own "..." button (ChatCard.jsx), matching the brief's
 * explicit "support a normal three-dot/context menu so long-press isn't
 * the only way" requirement. Only ever shows actions the caller passes
 * — no action here pretends to work independently of a real backend
 * call.
 */
export default function ChatActionSheet({ chat, isUnread, isMuted, onClose, onDelete, onToggleMute, onToggleRead }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center [animation:fadeIn_150ms_ease-out]">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="relative w-full sm:max-w-[340px] bg-white rounded-t-2xl sm:rounded-2xl p-2 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:pb-2 [animation:modalIn_200ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900 truncate pr-2">
            {chat.type === 'group' ? chat.groupName || 'Group' : 'Conversation'}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex-shrink-0 text-gray-400 hover:text-gray-600">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="py-1">
          <button
            type="button"
            onClick={onToggleRead}
            className="w-full flex items-center gap-3 px-3 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50 rounded-xl transition-colors duration-150"
          >
            {isUnread ? <MailOpen className="w-4.5 h-4.5 text-gray-400" /> : <CircleDot className="w-4.5 h-4.5 text-gray-400" />}
            Mark as {isUnread ? 'read' : 'unread'}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-full flex items-center gap-3 px-3 py-3 text-left text-[15px] text-gray-800 hover:bg-gray-50 rounded-xl transition-colors duration-150"
          >
            {isMuted ? <Bell className="w-4.5 h-4.5 text-gray-400" /> : <BellOff className="w-4.5 h-4.5 text-gray-400" />}
            {isMuted ? 'Unmute' : 'Mute'} notifications
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-3 py-3 text-left text-[15px] text-red-500 hover:bg-red-50 rounded-xl transition-colors duration-150"
          >
            <Trash2 className="w-4.5 h-4.5" />
            Delete chat
          </button>
        </div>
      </div>
    </div>
  )
}
