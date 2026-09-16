import { useEffect, useState } from 'react'
import { Megaphone, Pin, X } from 'lucide-react'
import { getActiveAnnouncements } from '../firebase/announcementService.js'

const PRIORITY_STYLES = {
  urgent: { chip: 'bg-red-50 text-red-700', border: 'border-red-100', icon: 'text-red-600', label: 'Urgent' },
  important: { chip: 'bg-amber-50 text-amber-700', border: 'border-amber-100', icon: 'text-amber-600', label: 'Important' },
  normal: { chip: 'bg-blue-50 text-blue-700', border: 'border-blue-100', icon: 'text-blue-600', label: 'Campus Notice' }
}

/**
 * Self-contained, own fetch/own state — a Campus Notice appearing or
 * being dismissed only ever re-renders this small component, never
 * HomePage or the feed beneath it. Real data only: renders nothing at
 * all when there are zero active (non-expired) announcements for this
 * viewer's college, rather than showing an empty placeholder card.
 *
 * Dismissal is local to this component's lifetime (not persisted) —
 * a pinned campus notice is meant to still be there next visit, this
 * only lets someone clear it from the current session's view.
 */
export default function CampusAnnouncementBanner({ collegeId }) {
  const [announcements, setAnnouncements] = useState([])
  const [dismissedIds, setDismissedIds] = useState(new Set())

  useEffect(() => {
    let cancelled = false
    getActiveAnnouncements(collegeId, { pageSize: 3 })
      .then((data) => {
        if (!cancelled) setAnnouncements(data)
      })
      .catch(() => {
        if (!cancelled) setAnnouncements([])
      })
    return () => {
      cancelled = true
    }
  }, [collegeId])

  const visible = announcements.filter((a) => !dismissedIds.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="mx-4 lg:mx-6 mt-3 space-y-2">
      {visible.map((a) => {
        const style = PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.normal
        return (
          <div key={a.id} className={`flex items-start gap-2.5 rounded-xl border ${style.border} bg-white px-3.5 py-3`}>
            <Megaphone className={`w-4 h-4 flex-shrink-0 mt-0.5 ${style.icon}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}>
                  {style.label}
                </span>
                {a.pinned && <Pin className="w-3 h-3 text-gray-300" fill="currentColor" />}
              </div>
              {a.title && <p className="mt-1 text-[13px] font-semibold text-gray-900">{a.title}</p>}
              <p className="mt-0.5 text-[12.5px] text-gray-600 leading-relaxed">{a.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setDismissedIds((prev) => new Set(prev).add(a.id))}
              aria-label="Dismiss notice"
              className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors duration-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
