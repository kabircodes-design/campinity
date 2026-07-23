import { Check, CheckCheck } from 'lucide-react'

function formatMessageTime(timestamp) {
  if (!timestamp?.toDate) return ''
  return timestamp.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * `isMine` is passed by the caller (compares message.senderId against
 * the signed-in uid) rather than assumed here, so this component has no
 * knowledge of "who I am" beyond what it's told.
 *
 * `message.pending` (set only on the local optimistic entry created by
 * useMessages.sendMessage, before the server confirms it) renders at
 * reduced opacity — a subtle "sending…" cue with no extra UI chrome.
 */
export default function MessageBubble({ message, isMine }) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${message.pending ? 'opacity-60' : ''}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
          isMine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        <div className={`mt-1 flex items-center gap-1 justify-end ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
          <span className="text-[10px]">{message.pending ? 'Sending…' : formatMessageTime(message.createdAt)}</span>
          {isMine &&
            !message.pending &&
            (message.read ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />)}
        </div>
      </div>
    </div>
  )
}