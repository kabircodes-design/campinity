import { useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { uploadChatImage } from '../firebase/chatService.js'

/**
 * Props match ChatPage.jsx's usage: <MessageInput onSend={sendMessage}
 * disabled={sending} />. New: chatId prop, needed only for the
 * attachment path (uploadChatImage(chatId, uid, file)) — the existing
 * text-send call shape (onSend(text.trim())) is completely unchanged.
 */
export default function MessageInput({ onSend, disabled, chatId }) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleSend = async () => {
    if (disabled || uploading) return
    if (!text.trim() && !attachment) return

    if (attachment) {
      const uid = auth.currentUser?.uid
      if (!uid || !chatId) return
      setUploading(true)
      setUploadError('')
      try {
        const imageUrl = await uploadChatImage(chatId, uid, attachment)
        onSend(text.trim(), { type: 'image', imageUrl })
        setAttachment(null)
        setPreview(null)
        setText('')
      } catch (err) {
        setUploadError(err?.message || "Couldn't send image. Try again.")
        setUploading(false)
        return
      }
      setUploading(false)
      return
    }

    onSend(text.trim())
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleAttach = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAttachment(file)
    setPreview(URL.createObjectURL(file))
    setUploadError('')
  }

  const clearAttachment = () => {
    setAttachment(null)
    setPreview(null)
    setUploadError('')
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
    <div className="px-3 py-2.5">
      {preview && (
        <div className="mb-2 relative inline-block">
          <img src={preview} alt="Attachment preview" className="h-20 rounded-lg object-cover" />
          <button
            type="button"
            onClick={clearAttachment}
            aria-label="Remove attachment"
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {uploadError && <p className="mb-1.5 text-xs text-red-500">{uploadError}</p>}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="Attach image"
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-40 transition-all duration-200"
        >
          <Paperclip className="w-4.5 h-4.5" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAttach} className="sr-only" />

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || uploading}
          placeholder={attachment ? 'Add a caption...' : 'Message...'}
          className="flex-1 resize-none rounded-[20px] border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all duration-300"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && !attachment) || disabled || uploading}
          aria-label="Send message"
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all duration-200"
        >
          {uploading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
