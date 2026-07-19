import {
    AtSign,
    Bell,
    CalendarDays,
    FileText,
    Heart,
    Megaphone,
    MessageCircle,
    Reply,
    ShoppingBag,
    UserPlus
  } from 'lucide-react'
  
  const iconConfig = {
    like: { icon: Heart, color: 'bg-red-500' },
    comment: { icon: MessageCircle, color: 'bg-blue-500' },
    reply: { icon: Reply, color: 'bg-blue-500' },
    follow: { icon: UserPlus, color: 'bg-purple-500' },
    mention: { icon: AtSign, color: 'bg-indigo-500' },
    club: { icon: Megaphone, color: 'bg-orange-500' },
    event: { icon: CalendarDays, color: 'bg-orange-500' },
    marketplace: { icon: ShoppingBag, color: 'bg-emerald-500' },
    notes: { icon: FileText, color: 'bg-blue-600' },
    system: { icon: Bell, color: 'bg-gray-500' }
  }
  
  export default function NotificationIcon({ type, large = false }) {
    const config = iconConfig[type] || iconConfig.system
    const Icon = config.icon
  
    if (large) {
      return (
        <span className={`w-11 h-11 rounded-full ${config.color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
        </span>
      )
    }
  
    return (
      <span className={`w-5 h-5 rounded-full ${config.color} flex items-center justify-center ring-2 ring-white`}>
        <Icon className="w-3 h-3 text-white" strokeWidth={2.2} />
      </span>
    )
  }