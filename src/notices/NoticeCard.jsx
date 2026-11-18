import { useState } from 'react'
import { AlertTriangle, ChevronDown, ExternalLink, Megaphone, Pin, Sparkles } from 'lucide-react'
import { noticeLinkTarget } from './noticeService.js'

/**
 * One notice, as students see it. Shared by the Profile Notice Board sheet
 * and the Admin Panel's live preview, so admins preview exactly what users get.
 */
export const PRIORITY_STYLE = {
  urgent: { label: 'Urgent', icon: AlertTriangle, chip: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400', rail: 'bg-red-500' },
  important: { label: 'Important', icon: Sparkles, chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', rail: 'bg-amber-500' },
  normal: { label: 'Notice', icon: Megaphone, chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400', rail: 'bg-blue-600' }
}

export function formatNoticeDate(msValue) {
  if (!msValue) return ''
  const d = new Date(msValue)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: 'numeric', minute: '2-digit' })
}

const LONG = 220

export default function NoticeCard({ notice, unread = false, defaultExpanded = false, onOpenLink, onExpand }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const p = PRIORITY_STYLE[notice.priority] || PRIORITY_STYLE.normal
  const Icon = p.icon
  const link = noticeLinkTarget(notice.actionUrl)
  const isLong = (notice.body || '').length > LONG

  const toggle = () => {
    setExpanded((v) => !v)
    if (!expanded) onExpand?.(notice)
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#151721] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${p.rail}`} aria-hidden="true" />
      {notice.imageUrl && <img src={notice.imageUrl} alt="" loading="lazy" className="w-full max-h-48 object-cover bg-gray-100 dark:bg-white/5" />}
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.chip}`}>
            <Icon className="w-3 h-3" /> {p.label}
          </span>
          {notice.pinned && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <Pin className="w-3 h-3" /> Pinned
            </span>
          )}
          {unread && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" aria-hidden="true" /> New
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">{formatNoticeDate(notice.publishAtMs)}</span>
        </div>
        <h3 className="mt-2 text-[15.5px] font-bold leading-snug text-gray-900 dark:text-gray-50 break-words">{notice.title}</h3>
        <p className={`mt-1 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line break-words ${isLong && !expanded ? 'line-clamp-4' : ''}`}>{notice.body}</p>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {isLong && (
            <button type="button" onClick={toggle} aria-expanded={expanded} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gray-600 dark:text-gray-300">
              {expanded ? 'Show less' : 'Read more'}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {link && (
            <button
              type="button"
              onClick={() => onOpenLink?.(link)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all duration-150"
            >
              {notice.actionLabel || 'Open'}
              {link.type === 'external' && <ExternalLink className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {notice.expiresAtMs && <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">Until {formatNoticeDate(notice.expiresAtMs)}</p>}
      </div>
    </article>
  )
}
