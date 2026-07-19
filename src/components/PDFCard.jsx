import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'

export default function PDFCard({ note }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/post/${note.postId}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
        <FileText className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{note.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {note.subject} · {note.fileSize}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">Uploaded by {note.uploader}</p>
      </div>
    </button>
  )
}