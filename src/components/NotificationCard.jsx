import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import Avatar from './Avatar.jsx'
import NotificationIcon from './NotificationIcon.jsx'

export default function NotificationCard({ notification, onRead, onDelete }) {
  const navigate = useNavigate()

  const handleOpen = () => {
    onRead(notification.id)
    if (notification.targetLink) {
      navigate(notification.targetLink)
    } else {
      navigate(`/notifications/${notification.id}`)
    }
  }

  const handleDelete = (event) => {
    event.stopPropagation()
    onDelete(notification.id)
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-300 ${
        notification.read ? 'hover:bg-gray-50' : 'bg-blue-50/60 hover:bg-blue-50'
      }`}
    >
      {notification.actorName ? (
        <div className="relative flex-shrink-0">
          <Avatar initials={notification.actorInitials} colorClass={notification.actorColorClass} size="md" />
          <span className="absolute -bottom-1 -right-1">
            <NotificationIcon type={notification.type} />
          </span>
        </div>
      ) : (
        <div className="flex-shrink-0">
          <NotificationIcon type={notification.type} large />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] text-gray-800 leading-snug">
          {notification.actorName && <span className="font-semibold text-gray-900">{notification.actorName} </span>}
          {notification.text}
        </p>
        <p className="mt-1 text-[11px] text-gray-400">{notification.time}</p>
      </div>

      {notification.thumbnail && (
        <div
          className={`w-11 h-11 rounded-lg flex-shrink-0 bg-gradient-to-br ${notification.thumbnail}`}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {!notification.read && <span className="w-2 h-2 rounded-full bg-blue-600" aria-hidden="true" />}
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete notification"
          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all duration-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </button>
  )
}