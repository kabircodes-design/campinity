import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCheck, Clock, X } from 'lucide-react'
import SharedCard from '../sharing/SharedCard.jsx'

/**
 * Props match ChatPage.jsx's exact usage: <MessageBubble message={...}
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
 */
export default function MessageBubble({ message, isMine, currentUid }) {
  const type = message.type || 'text' // existing messages have no `type` field at all — this is what makes them render exactly as before, through this same branch
  const [enlarged, setEnlarged] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  const time = message.pending
    ? null
    : message.createdAt?.toDate
    ? message.createdAt.toDate().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] lg:max-w-[68%] rounded-2xl ${type === 'image' ? 'p-1' : 'px-3.5 py-2'} ${
          isMine
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-md shadow-sm'
            : 'bg-white text-gray-900 rounded-bl-md border border-gray-100 shadow-sm'
        } ${message.pending ? 'opacity-60' : 'opacity-100'} transition-opacity duration-300`}
      >
        {type === 'text' ? (
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
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
        <div className={`mt-0.5 ${type === 'image' ? 'px-2 pb-1' : ''} flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
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
