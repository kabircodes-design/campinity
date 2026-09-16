import { useRef, useState } from 'react'
import { FileText, Paperclip, Send, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { uploadChatFile, uploadChatImage } from '../firebase/chatService.js'
import { useTypingBroadcast } from '../hooks/useTypingIndicator.js'

// At minimum: JPG/JPEG/PNG/WEBP/GIF images (previewed inline) and PDF
// documents (shown as a file card) — the two categories this app's
// Storage/rendering path actually supports end to end.
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB — generous for a campus chat attachment, not unbounded

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Props match ChatPage.jsx's usage: <MessageInput onSend={sendMessage}
 * disabled={sending} chatId={chatId} />. Two attachment kinds now:
 * images (existing uploadChatImage path, previewed as a thumbnail) and
 * generic files/PDFs (new uploadChatFile path, previewed as a file
 * card) — both go through the same sendMessage() call, just with
 * different `options`.
 */
export default function MessageInput({ onSend, disabled, chatId }) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null) // { file, kind: 'image' | 'file', previewUrl? }
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const { notifyTyping, stopTyping } = useTypingBroadcast(chatId, auth.currentUser?.uid)

  const handleSend = async () => {
    if (disabled || uploading) return
    if (!text.trim() && !attachment) return
    stopTyping() // covers "message is sent" — cleared before the async send/upload work below, not after

    if (attachment) {
      const uid = auth.currentUser?.uid
      if (!uid || !chatId) return
      setUploading(true)
      setUploadError('')
      try {
        if (attachment.kind === 'image') {
          const imageUrl = await uploadChatImage(chatId, uid, attachment.file)
          onSend(text.trim(), { type: 'image', imageUrl })
        } else {
          const uploaded = await uploadChatFile(chatId, uid, attachment.file)
          onSend(text.trim(), {
            type: 'file',
            fileUrl: uploaded.url,
            fileName: uploaded.name,
            fileSize: uploaded.size,
            mimeType: uploaded.mimeType
          })
        }
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
        setAttachment(null)
        setText('')
      } catch (err) {
        setUploadError(err?.message || "Couldn't send attachment. Try again.")
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
    event.target.value = '' // allow re-selecting the same file later
    if (!file) return
    setUploadError('')

    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`That file is too large (max ${formatFileSize(MAX_FILE_BYTES)}).`)
      return
    }
    const isImage = file.type.startsWith('image/')
    if (!isImage && file.type !== 'application/pdf') {
      setUploadError('Unsupported file type. Images (JPG/PNG/WEBP/GIF) and PDFs only.')
      return
    }

    setAttachment({ file, kind: isImage ? 'image' : 'file', previewUrl: isImage ? URL.createObjectURL(file) : null })
  }

  const clearAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setAttachment(null)
    setUploadError('')
  }

  const handleChange = (event) => {
    const value = event.target.value
    setText(value)
    if (value.trim()) {
      notifyTyping()
    } else {
      stopTyping() // covers "composer becomes empty"
    }
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

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    handleAttach({ target: { files: [file], value: '' } })
  }

  return (
    <div
      className="px-3 py-2.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {attachment && (
        <div className="mb-2">
          {attachment.kind === 'image' ? (
            <div className="relative inline-block">
              <img src={attachment.previewUrl} alt="Attachment preview" className="h-20 rounded-lg object-cover" />
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="relative inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 pr-8">
              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate max-w-[160px]">{attachment.file.name}</p>
                <p className="text-[10px] text-gray-400">{formatFileSize(attachment.file.size)}</p>
              </div>
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
        </div>
      )}
      {uploadError && <p className="mb-1.5 text-xs text-red-500">{uploadError}</p>}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          aria-label="Attach a photo or file"
          title="Attach a photo or file"
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 disabled:opacity-40 transition-all duration-200"
        >
          <Paperclip className="w-4.5 h-4.5" />
        </button>
        <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={handleAttach} className="sr-only" />

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || uploading}
          placeholder={attachment ? 'Add a caption...' : 'Type a message...'}
          aria-label="Message"
          className="flex-1 resize-none rounded-[20px] border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && !attachment) || disabled || uploading}
          aria-label="Send message"
          title="Send"
          className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
