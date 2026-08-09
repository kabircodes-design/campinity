import { MessageCircle } from 'lucide-react'

export default function CommentEmptyState() {
  return (
    <div className="py-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
        <MessageCircle className="w-5 h-5 text-blue-600" strokeWidth={1.7} />
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">Start the conversation</p>
      <p className="mt-1 text-xs text-gray-400">Be the first person to comment.</p>
    </div>
  )
}
