import { Check, CheckCheck, Clock } from 'lucide-react'

/**
 * Props match ChatPage.jsx's exact usage: <MessageBubble message={...}
 * isMine={boolean} />. message.pending (from useMessages.js's
 * optimistic send) shows a clock icon instead of a real timestamp —
 * that field only exists client-side before Firestore confirms the
 * write, so it's the correct signal for "still sending," not a guess.
 */
export default function MessageBubble({ message, isMine }) {
  const time = message.pending
    ? null
    : message.createdAt?.toDate
    ? message.createdAt.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          isMine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
        } ${message.pending ? 'opacity-60' : 'opacity-100'} transition-opacity duration-300`}
      >
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        <div className={`mt-0.5 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          {message.edited && (
            <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>Edited</span>
          )}
          {message.pending ? (
            <Clock className={`w-3 h-3 ${isMine ? 'text-white/60' : 'text-gray-400'}`} />
          ) : (
            <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-gray-400'}`}>{time}</span>
          )}
          {isMine && !message.pending && (
            message.read ? (
              <CheckCheck className="w-3 h-3 text-white/80" />
            ) : (
              <Check className="w-3 h-3 text-white/60" />
            )
          )}
        </div>
      </div>
    </div>
  )
}
