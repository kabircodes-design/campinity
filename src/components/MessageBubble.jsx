import { Check, CheckCheck } from 'lucide-react'

export default function MessageBubble({ message }) {
  const isMine = message.sender === 'me'

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
          isMine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        <div className={`mt-1 flex items-center gap-1 justify-end ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
          <span className="text-[10px]">{message.time}</span>
          {isMine &&
            (message.read ? (
              <CheckCheck className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            ))}
        </div>
      </div>
    </div>
  )
}