import { MessageCircle } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ChatCard from '../components/ChatCard.jsx'
import { conversations } from '../data/dummyMessages.js'

export default function ChatListPage() {
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center px-4">
            <span className="text-base font-bold tracking-tight text-gray-900">Messages</span>
          </div>
        </header>

        <main className="pb-24">
          {conversations.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto text-blue-600">
                <MessageCircle className="w-7 h-7" strokeWidth={1.7} />
              </div>
              <p className="mt-4 text-sm font-semibold text-gray-900">No messages yet</p>
              <p className="mt-1 text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                Start a conversation with a classmate, club, or study group and it'll show up here.
              </p>
            </div>
          ) : (
            <div>
              {conversations.map((conversation) => (
                <ChatCard key={conversation.id} conversation={conversation} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}