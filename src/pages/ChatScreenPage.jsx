import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import OnlineDot from '../components/OnlineDot.jsx'
import BottomNav from '../components/BottomNav.jsx'
import MessageBubble from '../components/MessageBubble.jsx'
import MessageInput from '../components/MessageInput.jsx'
import TypingIndicator from '../components/TypingIndicator.jsx'
import { conversations, messagesByConversationId } from '../data/dummyMessages.js'

const dummyReplies = [
  'Got it, thanks!',
  'Sounds good 👍',
  'Let me check and get back to you',
  'Haha true',
  'Okay, see you then!'
]

export default function ChatScreenPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const bottomRef = useRef(null)

  const conversation = conversations.find((item) => item.id === conversationId)
  const [messages, setMessages] = useState(() => messagesByConversationId[conversationId] || [])
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  if (!conversation) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">Conversation not found</p>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back to Messages
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  const handleSend = (text) => {
    const newMessage = {
      id: `local-${Date.now()}`,
      sender: 'me',
      text,
      time: 'Just now',
      read: false
    }
    setMessages((prev) => [...prev, newMessage])

    setIsTyping(true)
    window.setTimeout(() => {
      setIsTyping(false)
      const reply = dummyReplies[Math.floor(Math.random() * dummyReplies.length)]
      setMessages((prev) => [
        ...prev,
        {
          id: `local-reply-${Date.now()}`,
          sender: 'them',
          text: reply,
          time: 'Just now',
          read: true
        }
      ])
    }, 1600)
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex flex-col">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/messages')}
              className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative flex-shrink-0">
              <Avatar initials={conversation.initials} colorClass={conversation.colorClass} size="sm" />
              {conversation.isOnline && <OnlineDot className="w-2.5 h-2.5 absolute bottom-0 right-0" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{conversation.name}</p>
              <p className="text-[11px] text-gray-400">{conversation.isOnline ? 'Online' : 'Offline'}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 space-y-3 pb-32">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </main>

        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-30 w-full max-w-[480px] lg:max-w-[520px] bg-white/95 backdrop-blur-md border-t border-gray-100">
          <MessageInput onSend={handleSend} />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}