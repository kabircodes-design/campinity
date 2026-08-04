import { useRef, useState } from 'react'
import { Send } from 'lucide-react'

/** Props match ChatPage.jsx's usage: <MessageInput onSend={sendMessage} disabled={sending} />. */
export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleChange = (event) => {
    setText(event.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 px-3 py-2.5">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Message..."
        className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        aria-label="Send message"
        className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
