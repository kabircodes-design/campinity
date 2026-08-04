import { MessageCircle } from 'lucide-react'

export default function EmptyChat() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
        <MessageCircle className="w-6 h-6 text-blue-600" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900">No messages yet</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[240px] mx-auto leading-relaxed">
        When you start a conversation, it'll show up here.
      </p>
    </div>
  )
}
