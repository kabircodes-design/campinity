import { useEffect, useState } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { getChatMediaMessages } from '../firebase/chatService.js'

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "Media/files/links" — group/chat menu. Real data via getChatMediaMessages, not a filter of whatever's already scrolled into view. */
export default function ChatMediaModal({ chatId, onClose }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    getChatMediaMessages(chatId)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load shared media.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chatId])

  const images = items.filter((m) => m.type === 'image')
  const files = items.filter((m) => m.type === 'file')

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="relative w-full sm:max-w-[420px] bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between flex-shrink-0">
          <p className="text-base font-bold text-gray-900">Media &amp; Files</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-gray-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No shared media yet.</div>
          ) : (
            <div className="space-y-5">
              {images.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Photos</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {images.map((m) => (
                      <a
                        key={m.id}
                        href={m.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                      >
                        <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Files</p>
                  <div className="space-y-1.5">
                    {files.map((m) => (
                      <a
                        key={m.id}
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2.5 hover:bg-gray-50 transition-colors duration-150"
                      >
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">{m.fileName || 'File'}</p>
                          <p className="text-[11px] text-gray-400">{formatFileSize(m.fileSize)}</p>
                        </div>
                        <Download className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
