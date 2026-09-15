import { useNavigate } from 'react-router-dom'
import { CalendarDays, FileText, Image as ImageIcon, PenSquare } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

/**
 * Compact composer launcher for the Home feed. Every action here opens
 * the real CreatePostPage (/create) — this is deliberately NOT a
 * second, parallel post-creation implementation; CreatePostPage already
 * owns text/category/image/PDF upload, moderation, and expiry logic,
 * and duplicating any of that here would violate "preserve existing
 * functionality" as much as breaking it would.
 *
 * Action buttons only cover what CreatePostPage actually supports —
 * image upload and PDF/notes upload are real; there is no video upload
 * or poll feature anywhere in this app, so those are intentionally
 * absent rather than shown as non-functional buttons. "Event" opens
 * the composer with its existing category selector, where Event is one
 * of six real category tags — not a separate structured event flow,
 * since no such flow exists.
 */
export default function PostComposer({ profile, initials, colorClass, firstName }) {
  const navigate = useNavigate()

  const actions = [
    { key: 'photo', label: 'Photo', icon: ImageIcon, color: 'text-emerald-500' },
    { key: 'notes', label: 'Notes', icon: FileText, color: 'text-blue-500' },
    { key: 'event', label: 'Event', icon: CalendarDays, color: 'text-amber-500' }
  ]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5 dark:border-white/10 dark:bg-[#11131a] dark:shadow-none">
      <button
        type="button"
        onClick={() => navigate('/create')}
        className="group flex w-full items-center gap-3 text-left"
        aria-label="Create a post"
      >
        <Avatar initials={initials} colorClass={colorClass} size="sm" src={getProfileIdentityImage(profile) || undefined} />
        <span className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-400 transition-all duration-200 group-hover:bg-white group-hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:group-hover:bg-white/10 dark:group-hover:border-white/20">
          What's on your mind{firstName ? `, ${firstName}` : ''}?
        </span>
        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white group-hover:bg-blue-700 transition-all duration-200 group-active:scale-95">
          <PenSquare className="w-4 h-4" />
        </span>
      </button>

      <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-3 dark:border-white/10">
        {actions.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate('/create')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5 transition-all duration-200"
          >
            <Icon className={`w-4 h-4 ${color}`} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
