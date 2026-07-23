import { useState } from 'react'
import { Camera, Paperclip, Send, Smile } from 'lucide-react'

/**
 * Enter-to-send on desktop is native <form> behavior — no extra keydown
 * handler needed, since submitting the form is exactly what Enter
 * already does inside a text input.
 */
export default function MessageInput({ onSend, disabled = false }) {
  const [text, setText] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1 px-2 py-2.5">
      <button
        type="button"
        aria-label="Emoji"
        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-300"
      >
        <Smile className="w-5 h-5" />
      </button>
      <button
        type="button"
        aria-label="Attach file"
        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-300"
      >
        <Paperclip className="w-5 h-5" />
      </button>
      <button
        type="button"
        aria-label="Camera"
        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-300"
      >
        <Camera className="w-5 h-5" />
      </button>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Message..."
        disabled={disabled}
        className="flex-1 min-w-0 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        aria-label="Send message"
        className="w-9 h-9 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
  )
}