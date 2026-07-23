import { MessageCircle } from 'lucide-react'

export default function EmptyChat() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
        <MessageCircle className="w-7 h-7" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900">No messages yet</p>
      <p className="mt-1 text-sm text-gray-400 leading-relaxed max-w-[240px] mx-auto">
        Start a conversation with a classmate from their profile.
      </p>
    </div>
  )
}