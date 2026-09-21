import { useEffect, useState } from 'react'
import { getCampusJourney } from './campusJourney.js'
import { formatTimeAgo } from '../firebase/postService.js'

/** Renders nothing if there are fewer than 2 real milestones — a brand-new account with just a join date isn't a "journey" yet, and this section shouldn't compete for space until there's something real to show. */
export default function CampusJourneyCard({ uid, className = '' }) {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getCampusJourney(uid).then((rows) => {
      if (!cancelled) setEvents(rows)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  if (!events || events.length < 2) return null

  return (
    <div className={`rounded-2xl border border-gray-100 p-4 ${className}`}>
      <p className="text-sm font-bold text-gray-900">Your Campus Journey</p>
      <div className="mt-3 space-y-0">
        {events.map((event, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">{event.icon}</span>
              {i < events.length - 1 && <span className="w-px flex-1 bg-gray-100 my-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-sm text-gray-800 leading-snug">{event.label}</p>
              <p className="text-[11px] text-gray-400">{formatTimeAgo(event.ts)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
