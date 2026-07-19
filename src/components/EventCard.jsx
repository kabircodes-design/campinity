import { useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin } from 'lucide-react'

export default function EventCard({ event }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/event/${event.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <div
        className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${event.gradient} flex items-center justify-center`}
      >
        <CalendarDays className="w-5 h-5 text-white/90" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
        <p className="text-xs text-gray-400 truncate">{event.org}</p>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-400">
          <span>{event.date}</span>
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {event.location}
          </span>
        </div>
      </div>
    </button>
  )
}