import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  Download,
  FileText,
  MoreVertical,
  Pencil,
  Phone,
  PhoneMissed,
  Trash2,
  Video,
  X
} from 'lucide-react'
import SharedCard from '../sharing/SharedCard.jsx'

const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🙏']

function formatCallDuration(totalSeconds) {
  const m = Math.floor((totalSeconds || 0) / 60)
  const s = (totalSeconds || 0) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** { '❤️': ['uid1','uid2'], '👍': ['uid3'] } from the raw { uid: emoji } map, so the summary row can group by emoji without recomputing this per render inside JSX. */
function groupReactions(reactions) {
  const groups = {}
  Object.entries(reactions || {}).forEach(([uid, emoji]) => {
    if (!groups[emoji]) groups[emoji] = []
    groups[emoji].push(uid)
  })
  return groups
}

/**
 * Props match ChatPage.jsx's usage: <MessageBubble message={...}
 * isMine={boolean} />. message.pending (from useMessages.js's
 * optimistic send) shows a clock icon instead of a real timestamp —
 * that field only exists client-side before Firestore confirms the
 * write, so it's the correct signal for "still sending," not a guess.
 *
 * type==='image' is a new, dedicated branch — the prior version
 * always rendered SharedCard for any non-text type, which is correct
 * for shared posts but wrong for a real chat image message. imageUrl
 * itself was already a fully-supported field on sendMessage()
 * (confirmed by reading that function directly) — only the rendering
 * side was missing.
 *
 * Phase 1 social pass — reactions/reply/edit/delete are all additive:
 * every prop below is optional and defaults to a no-op, so this
 * component still renders exactly as before for any caller that
 * doesn't pass them.
 */
export default function MessageBubble({
  message,
  isMine,
  currentUid,
  onRetry,
  onReply,
  onReact,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onJumpToMessage,
  highlighted
}) {
  const type = message.type || 'text' // existing messages have no `type` field at all — this is what makes them render exactly as before, through this same branch
  const [enlarged, setEnlarged] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(message.text || '')
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  const time = message.pending
    ? null
    : message.createdAt?.toDate
    ? message.createdAt.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''

  const canEdit = isMine && !message.pending && !message.failed && type === 'text' && typeof onEdit === 'function'
  const canReact = !message.pending && !message.failed && typeof onReact === 'function'
  const canReply = !message.pending && !message.failed && typeof onReply === 'function'
  const showActions = canEdit || canReact || canReply || typeof onDeleteForMe === 'function'

  const reactionGroups = groupReactions(message.reactions)
  const myReaction = currentUid ? message.reactions?.[currentUid] : null

  const startEdit = () => {
    setEditText(message.text || '')
    setEditing(true)
    setMenuOpen(false)
  }

  const saveEdit = () => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== message.text) onEdit?.(message.id, trimmed)
    setEditing(false)
  }

  // Call-history entries are system-style rows, not left/right chat
  // bubbles — matching how a real call log reads (and how the date
  // separators elsewhere on this page are rendered), not disguised as
  // something either participant "said."
  if (type === 'call') {
    const isMissedOrDeclined = message.callOutcome === 'missed' || message.callOutcome === 'declined'
    const CallIcon = isMissedOrDeclined ? PhoneMissed : message.callType === 'video' ? Video : Phone
    const label =
      message.callOutcome === 'missed'
        ? `Missed ${message.callType === 'video' ? 'video' : 'voice'} call`
        : message.callOutcome === 'declined'
          ? `Declined ${message.callType === 'video' ? 'video' : 'voice'} call`
          : `${message.callType === 'video' ? 'Video' : 'Voice'} call · ${formatCallDuration(message.callDurationSec)}`
    return (
      <div className="flex justify-center my-1">
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
            isMissedOrDeclined ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <CallIcon className="w-3.5 h-3.5" />
          {label}
          {time && <span className="text-gray-400">· {time}</span>}
        </div>
      </div>
    )
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={`group/bubble flex items-end gap-1 ${isMine ? 'justify-end' : 'justify-start'} ${
        highlighted ? 'rounded-xl [animation:messageHighlight_1.5s_ease-out]' : ''
      }`}
    >
      {/* Actions trigger sits OUTSIDE the bubble on the side nearest the
          gutter, never overlapping message content. Low-opacity by
          default so it doesn't compete with the conversation, fully
          opaque on hover (desktop) — always tappable either way, no
          long-press needed on mobile. */}
      {showActions && !editing && (
        <div className={`relative flex-shrink-0 ${isMine ? 'order-first' : 'order-last'}`} ref={menuRef}>
          <button
            type="button"
            aria-label="Message actions"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-60 lg:opacity-0 lg:group-hover/bubble:opacity-100 transition-all duration-200"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <div
              className={`absolute z-30 top-8 ${isMine ? 'right-0' : 'left-0'} w-44 rounded-xl border border-gray-100 bg-white shadow-lg py-1.5 [animation:modalIn_150ms_cubic-bezier(0.16,1,0.3,1)]`}
            >
              {canReact && (
                <div className="flex items-center justify-between px-2.5 pb-1.5 mb-1 border-b border-gray-50">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React ${emoji}`}
                      onClick={() => {
                        onReact(message.id, emoji)
                        setMenuOpen(false)
                      }}
                      className={`w-6 h-6 flex items-center justify-center text-base rounded-full hover:scale-125 active:scale-95 transition-transform duration-150 ${
                        myReaction === emoji ? 'bg-blue-50' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              {canReply && (
                <button
                  type="button"
                  onClick={() => {
                    onReply(message)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                >
                  <CornerUpLeft className="w-3.5 h-3.5 text-gray-400" /> Reply
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit
                </button>
              )}
              {typeof onDeleteForMe === 'function' && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForMe(message.id)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400" /> Delete for me
                </button>
              )}
              {isMine && typeof onDeleteForEveryone === 'function' && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteForEveryone(message.id)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors duration-150"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Desktop cap added alongside the wider chat column (Messages
          right-panel removal pass) — 68% of a much wider center column
          on a 1920px screen would otherwise stretch a single message
          bubble absurdly wide; min() keeps it proportional on normal
          widths and hard-capped on very large ones. */}
      <div className="max-w-[78%] lg:max-w-[min(68%,560px)] flex flex-col">
        <div
          className={`rounded-2xl ${type === 'image' && !editing ? 'p-1' : 'px-3.5 py-2'} ${
            isMine
              ? 'bg-blue-600 text-white rounded-br-md shadow-sm'
              : 'bg-white text-gray-900 rounded-bl-md border border-gray-100 shadow-sm'
          } ${message.pending ? 'opacity-60' : 'opacity-100'} transition-opacity duration-300`}
        >
          {message.replyTo && !editing && (
            <button
              type="button"
              onClick={() => onJumpToMessage?.(message.replyTo.messageId)}
              className={`block w-full text-left rounded-lg px-2 py-1 mb-1.5 border-l-2 ${
                isMine ? 'border-white/50 bg-white/10 hover:bg-white/15' : 'border-blue-300 bg-gray-50 hover:bg-gray-100'
              } transition-colors duration-150`}
            >
              <p className={`text-[11px] font-semibold ${isMine ? 'text-white/80' : 'text-blue-600'}`}>
                {message.replyTo.senderId === currentUid ? 'You' : 'Reply'}
              </p>
              <p className={`text-[12px] truncate ${isMine ? 'text-white/70' : 'text-gray-500'}`}>
                {message.replyTo.text || (message.replyTo.type === 'image' ? 'Photo' : 'Attachment')}
              </p>
            </button>
          )}

          {editing ? (
            <div className="min-w-[180px]">
              <textarea
                autoFocus
                rows={2}
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    saveEdit()
                  }
                  if (event.key === 'Escape') setEditing(false)
                }}
                className={`w-full resize-none rounded-lg px-2 py-1.5 text-[14px] outline-none ${
                  isMine ? 'bg-white/10 text-white placeholder:text-white/50' : 'bg-gray-50 text-gray-900'
                }`}
              />
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className={`text-[11px] font-semibold ${isMine ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className={`text-[11px] font-semibold ${isMine ? 'text-white hover:text-white/90' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Save
                </button>
              </div>
            </div>
          ) : type === 'text' ? (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
          ) : type === 'file' ? (
            <div>
              <a
                href={message.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 -mx-1 transition-colors duration-200 ${
                  isMine ? 'hover:bg-white/10' : 'hover:bg-gray-50'
                }`}
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMine ? 'bg-white/15' : 'bg-blue-50 text-blue-600'}`}>
                  <FileText className="w-4.5 h-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate">{message.fileName || 'File'}</p>
                  <p className={`text-[11px] ${isMine ? 'text-white/70' : 'text-gray-400'}`}>{formatFileSize(message.fileSize)}</p>
                </div>
                <Download className={`w-4 h-4 flex-shrink-0 ${isMine ? 'text-white/80' : 'text-gray-400'}`} />
              </a>
              {message.text && (
                <p className="mt-1 px-1 text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              )}
            </div>
          ) : type === 'image' ? (
            <div>
              {imageFailed ? (
                <div className="w-48 h-32 rounded-xl flex items-center justify-center bg-black/10 text-xs">
                  Couldn't load image
                </div>
              ) : (
                <button type="button" onClick={() => setEnlarged(true)} className="block relative">
                  {!imageLoaded && <div className="w-48 h-32 rounded-xl bg-black/10 animate-pulse" />}
                  <img
                    src={message.imageUrl}
                    alt=""
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageFailed(true)}
                    className={`max-w-[220px] rounded-xl ${imageLoaded ? 'block' : 'hidden'}`}
                  />
                </button>
              )}
              {message.text && (
                <p className="mt-1.5 px-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              )}
            </div>
          ) : (
            <div className={isMine ? '[&_button]:bg-white/10' : ''}>
              <SharedCard message={message} currentUid={currentUid} />
              {message.text && (
                <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
              )}
            </div>
          )}
          <div className={`mt-0.5 ${type === 'image' && !editing ? 'px-2 pb-1' : ''} flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {message.edited && (
              <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>Edited</span>
            )}
            {message.failed ? (
              <span className="flex items-center gap-1 text-[10px] text-red-100">
                Failed to send
                <button
                  type="button"
                  onClick={() => onRetry?.(message.id)}
                  className="font-semibold underline underline-offset-2"
                >
                  Retry
                </button>
              </span>
            ) : message.pending ? (
              <Clock className={`w-3 h-3 ${isMine ? 'text-white/60' : 'text-gray-400'}`} />
            ) : (
              <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{time}</span>
            )}
            {isMine && !message.pending && !message.failed && (
              message.read ? (
                <CheckCheck className="w-3 h-3 text-white/80" />
              ) : (
                <Check className="w-3 h-3 text-white/60" />
              )
            )}
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(reactionGroups).map(([emoji, uids]) => (
              <button
                key={emoji}
                type="button"
                disabled={!canReact}
                onClick={() => onReact?.(message.id, emoji)}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-all duration-150 ${
                  uids.includes(currentUid) ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <span>{emoji}</span>
                {uids.length > 1 && <span className="text-gray-500 font-medium">{uids.length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {enlarged &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center px-4">
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              aria-label="Close"
              className="absolute top-4 right-4 text-white/90 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={message.imageUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>,
          document.body
        )}
    </div>
  )
}
