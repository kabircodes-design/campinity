import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, Megaphone, Pin, RefreshCw, X } from 'lucide-react'
import { useBackToClose } from '../navigation/overlayBackStack.js'
import NoticeCard, { PRIORITY_STYLE } from './NoticeCard.jsx'
import { fetchMyNotices, fetchNoticeReads, isUnread, markNoticeRead } from './noticeService.js'

/**
 * CAMPINITY NOTICE BOARD — lives inside the existing blue cover of the
 * user's OWN profile (ProfileHeader). The cover's gradient, height and
 * settings button are unchanged; the board sits in its upper area, clear
 * of the avatar that overlaps the cover's bottom-left edge.
 */
function useNotices(uid, collegeId) {
  const [state, setState] = useState({ loading: true, error: '', notices: [], reads: {} })
  const load = useCallback(async () => {
    if (!uid) return
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const [notices, reads] = await Promise.all([fetchMyNotices({ uid, collegeId }), fetchNoticeReads(uid).catch(() => ({}))])
      setState({ loading: false, error: '', notices, reads })
    } catch (err) {
      // 'unavailable' = no connection -> offer retry. permission-denied /
      // failed-precondition (missing index) / not-found = the Notice Board
      // backend isn't available in this environment -> behave like an empty
      // board instead of showing students an error they can't act on.
      const code = err?.code || ''
      const kind = code === 'unavailable' ? 'offline' : ['permission-denied', 'failed-precondition', 'not-found', 'unimplemented'].includes(code) ? 'disabled' : 'error'
      if (kind !== 'offline') console.warn('[NoticeBoard] notices unavailable:', code || err?.message)
      setState((s) => ({ ...s, loading: false, notices: [], error: kind === 'disabled' ? '' : kind }))
    }
  }, [uid, collegeId])
  useEffect(() => {
    load()
  }, [load])
  const markRead = useCallback(
    (groupIds) => {
      const ids = groupIds.filter(Boolean)
      if (!uid || !ids.length) return
      setState((s) => {
        const reads = { ...s.reads }
        ids.forEach((id) => (reads[id] = Date.now()))
        return { ...s, reads }
      })
      ids.forEach((id) => markNoticeRead(uid, id).catch(() => {}))
    },
    [uid]
  )
  return { ...state, reload: load, markRead }
}

function BoardSheet({ open, onClose, notices, reads, focusId, onMarkRead }) {
  const navigate = useNavigate()
  useBackToClose(open, onClose)
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  // Opening the sheet on a notice marks that notice read; short notices are fully visible.
  useEffect(() => {
    if (open && focusId) onMarkRead([focusId])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusId])
  useEffect(() => {
    if (!open || !focusId) return
    const t = window.setTimeout(() => document.getElementById(`notice-${focusId}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 80)
    return () => window.clearTimeout(t)
  }, [open, focusId])

  if (!open) return null
  const unreadIds = notices.filter((n) => isUnread(n, reads)).map((n) => n.groupId)
  const openLink = (link) => {
    if (link.type === 'internal') {
      onClose()
      navigate(link.to)
    } else window.open(link.href, '_blank', 'noopener,noreferrer')
  }

  return createPortal(
    <div className="fixed inset-0 z-[950] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="notice-board-title">
      <button type="button" aria-label="Close notice board" className="absolute inset-0 bg-black/45 animate-[fadeIn_200ms_ease]" onClick={onClose} />
      <div className="relative w-full sm:max-w-[560px] max-h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-gray-50 dark:bg-[#0d0e15] shadow-2xl animate-[modalIn_260ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden="true" />
        <header className="flex items-center gap-3 px-5 pt-4 pb-3">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
            <Megaphone className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p id="notice-board-title" className="text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">
              Campinity Notice Board
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Official notices from the Campinity team</p>
          </div>
          {unreadIds.length > 0 && (
            <button type="button" onClick={() => onMarkRead(unreadIds)} className="hidden sm:inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-600 dark:text-blue-400">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200/70 dark:hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 space-y-3">
          {notices.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No notices right now.</p>
          ) : (
            notices.map((n) => (
              <div key={n.groupId} id={`notice-${n.groupId}`}>
                <NoticeCard notice={n} unread={isUnread(n, reads)} defaultExpanded={n.groupId === focusId} onOpenLink={openLink} onExpand={() => onMarkRead([n.groupId])} />
              </div>
            ))
          )}
          {unreadIds.length > 0 && (
            <button type="button" onClick={() => onMarkRead(unreadIds)} className="sm:hidden w-full py-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400">
              Mark all as read
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function NoticeBoard({ uid, collegeId }) {
  const { loading, error, notices, reads, reload, markRead } = useNotices(uid, collegeId)
  const [sheet, setSheet] = useState({ open: false, focusId: null })
  const unreadCount = useMemo(() => notices.filter((n) => isUnread(n, reads)).length, [notices, reads])
  const close = useCallback(() => setSheet({ open: false, focusId: null }), [])

  return (
    <section aria-label="Campinity Notice Board" className="absolute inset-x-0 top-0 pt-3 lg:pt-4">
      <div className="flex items-center gap-2 pl-4 pr-16 lg:pl-6">
        <button
          type="button"
          onClick={() => setSheet({ open: true, focusId: null })}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm px-3 py-1 lg:py-1.5 text-white transition-colors duration-200"
        >
          <Pin className="w-3.5 h-3.5 -rotate-12" />
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase">Notice Board</span>
          {unreadCount > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-blue-700 text-[10.5px] font-bold flex items-center justify-center" aria-label={`${unreadCount} unread`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-2 lg:mt-3">
        {loading ? (
          <div className="flex gap-2.5 px-4 lg:px-6 overflow-hidden" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="flex-shrink-0 w-[230px] h-[60px] lg:h-[76px] rounded-2xl bg-white/20 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-4 lg:px-6">
            <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 rounded-2xl bg-white/15 px-3.5 py-2.5 text-[12.5px] font-medium text-white">
              <RefreshCw className="w-3.5 h-3.5" /> {error === 'offline' ? "You're offline — tap to retry" : "Couldn't load notices — tap to retry"}
            </button>
          </div>
        ) : notices.length === 0 ? (
          <div className="px-4 lg:px-6">
            <p className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2.5 text-[12.5px] font-medium text-white/90">
              <Megaphone className="w-4 h-4 flex-shrink-0" /> No notices right now. Official Campinity announcements will appear here.
            </p>
          </div>
        ) : (
          <ul className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scroll-px-4 lg:scroll-px-6 px-4 lg:px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list">
            {notices.map((n) => {
              const p = PRIORITY_STYLE[n.priority] || PRIORITY_STYLE.normal
              const unread = isUnread(n, reads)
              return (
                <li key={n.groupId} className="snap-start flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSheet({ open: true, focusId: n.groupId })}
                    className="relative w-[230px] lg:w-[260px] h-[60px] lg:h-[76px] text-left rounded-2xl bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-sm pl-4 pr-3 py-2 shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 overflow-hidden"
                  >
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${p.rail}`} aria-hidden="true" />
                    <span className="flex items-center gap-1.5">
                      {n.pinned && <Pin className="w-3 h-3 text-gray-400 flex-shrink-0" aria-label="Pinned" />}
                      <span className="text-[13px] font-bold text-gray-900 dark:text-gray-50 truncate">{n.title}</span>
                      {unread && <span className="ml-auto w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 text-[12px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-1 lg:line-clamp-2">{n.body}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <BoardSheet open={sheet.open} focusId={sheet.focusId} onClose={close} notices={notices} reads={reads} onMarkRead={markRead} />
    </section>
  )
}
