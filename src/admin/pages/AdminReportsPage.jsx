import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, Flag, Gavel, ImageOff, Search, UserRound } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { useAdminWorkspace } from '../hooks/useAdminWorkspace.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, ErrorState, KeyValue, PageHeader, Skeleton, fmtDateTime, fmtRelative } from '../components/ui.jsx'
import { ACTION_LABELS } from '../utils/auditLogFormat.js'

/**
 * Reports inbox.
 *  - List: adminListReports (status tab, newest first, cursor pagination;
 *    reporter/owner shown by name — the server returns names, never email).
 *  - Investigate: adminGetReportContext (read-only) — the reported
 *    content, its owner, other reports on the same content and owner,
 *    and prior admin actions on it.
 *  - Resolve / Dismiss: adminResolveReport (server-audited), confirmed.
 *    Removing content or suspending the owner lives in Content
 *    Moderation / Users, which already implement those actions.
 */
const STATUS_TABS = [
  ['pending', 'Pending'],
  ['resolved', 'Resolved'],
  ['dismissed', 'Dismissed']
]
const TYPE_FILTERS = [
  ['', 'All types'],
  ['post', 'Posts'],
  ['comment', 'Comments'],
  ['story', 'Stories'],
  ['product', 'Listings'],
  ['user', 'Profiles'],
  ['app_problem', 'Problem reports']
]
const tsMs = (ts) => (ts?._seconds ?? ts?.seconds ? (ts._seconds ?? ts.seconds) * 1000 : typeof ts === 'number' ? ts : null)
const who = (p, fallback) => (p ? p.displayName || (p.username ? `@${p.username}` : fallback) : fallback)

function ReportContext({ reportId, onResolve, onOpenUser, onModerate }) {
  const { sessionToken } = useAdminSession()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    callAdmin('adminGetReportContext', { sessionToken, reportId })
      .then(setData)
      .catch((err) => setError(err?.message || 'Could not load this report.'))
  }, [sessionToken, reportId])
  useEffect(load, [load])

  if (error) return <ErrorState message={error} onRetry={load} />
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    )
  }
  const { report, target, reporter, owner } = data
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[17px] font-bold text-gray-900">{report.reason || 'No reason given'}</p>
          <Badge tone={report.status === 'pending' ? 'amber' : 'gray'}>{report.status}</Badge>
        </div>
        {report.details && <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">“{report.details}”</p>}
        <p className="mt-2 text-xs text-gray-500">
          Reported {fmtDateTime(report.createdAtMs)} by {reporter ? who(reporter, 'a user') : 'an account that no longer exists'}
        </p>
      </div>

      {report.status === 'pending' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onResolve('resolved')}>Resolve</Button>
          <Button onClick={() => onResolve('dismissed')}>Dismiss</Button>
          <Button variant="ghost" onClick={onModerate}>
            <Gavel className="w-3.5 h-3.5" /> Remove content / restrict…
          </Button>
        </div>
      )}

      <Card title={report.targetType === 'app_problem' ? 'Problem report from the app' : `Reported ${target.type || 'content'}`} padded>
        {report.targetType === 'app_problem' ? (
          <p className="text-sm text-gray-600">A student used Settings › Help › Report a problem. Their description (with app version, platform and page) is shown above; the category is the reason.</p>
        ) : !target.exists ? (
          <p className="text-sm text-gray-500">
            {target.type === 'comment' ? 'Comment reports don’t record which post they belong to, so the comment can’t be shown here.' : 'This content no longer exists or could not be loaded.'}
          </p>
        ) : target.type === 'user' ? (
          <p className="text-sm text-gray-600">The report is about the profile itself — see the owner below.</p>
        ) : (
          <div className="space-y-3">
            {target.text && <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{target.text}</p>}
            {target.imageUrl ? (
              <img src={target.imageUrl} alt="Reported media" className="max-h-72 rounded-xl border border-gray-100 object-contain bg-gray-100" loading="lazy" />
            ) : null}
            {!target.text && !target.imageUrl && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5"><ImageOff className="w-4 h-4" /> No text or media.</p>
            )}
            <p className="text-xs text-gray-500">Posted {fmtRelative(target.createdAtMs)}{target.visibility ? ` · ${target.visibility}` : ''}</p>
          </div>
        )}
      </Card>

      <section>
        <h3 className="text-[13.5px] font-semibold text-gray-900">Owner</h3>
        {owner ? (
          <button type="button" onClick={() => onOpenUser(owner.uid)} className="mt-2 w-full text-left rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-3 hover:bg-gray-100">
            <UserRound className="w-4 h-4 text-gray-500" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold text-gray-900 truncate">{owner.displayName || owner.username || owner.uid}</span>
              <span className="block text-xs text-gray-500">
                {owner.username ? `@${owner.username} · ` : ''}
                {owner.moderationStatus !== 'active' ? owner.moderationStatus : 'active'} · {owner.verifiedCampus ? 'campus verified' : 'not verified'}
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Owner unknown or account deleted.</p>
        )}
      </section>

      {[
        ['Other reports on this content', data.sameTargetReports],
        ['Other reports on this owner', data.sameOwnerReports]
      ].map(([title, list]) => (
        <section key={title}>
          <h3 className="text-[13.5px] font-semibold text-gray-900">
            {title} <span className="text-gray-400 font-normal">({list.length}{list.length >= 49 ? '+' : ''})</span>
          </h3>
          {list.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">None.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 max-h-56 overflow-y-auto">
              {list.map((r) => (
                <li key={r.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[13px] text-gray-900 truncate">{r.reason || 'No reason'}</span>
                    <span className="block text-xs text-gray-500">{r.targetType} · {fmtRelative(r.createdAtMs)}</span>
                  </span>
                  <Badge tone={r.status === 'pending' ? 'amber' : 'gray'}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section>
        <h3 className="text-[13.5px] font-semibold text-gray-900">Resolution history</h3>
        {data.history.length === 0 && !report.reviewedAtMs ? (
          <p className="mt-2 text-sm text-gray-500">No admin action recorded on this content yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {report.reviewedAtMs && (
              <li className="px-3 py-2">
                <p className="text-[13px] text-gray-900">This report {report.status}</p>
                <p className="text-xs text-gray-500">{fmtDateTime(report.reviewedAtMs)}{report.moderationAction ? ` · ${report.moderationAction}` : ''}</p>
              </li>
            )}
            {data.history.map((h) => (
              <li key={h.id} className="px-3 py-2">
                <p className="text-[13px] text-gray-900">{ACTION_LABELS[h.action] || h.action}</p>
                <p className="text-xs text-gray-500">{[h.reason, fmtDateTime(h.createdAtMs)].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <KeyValue items={[['Report ID', <code key="r" className="text-xs break-all">{report.id}</code>], ['Target ID', <code key="t" className="text-xs break-all">{report.targetId}</code>]]} />
    </div>
  )
}

export default function AdminReportsPage() {
  const { sessionToken } = useAdminSession()
  const { navigate } = useAdminWorkspace()
  const [statusTab, setStatusTab] = useState('pending')
  const [typeFilter, setTypeFilter] = useState('')
  const [text, setText] = useState('')
  const [reports, setReports] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const reqId = useRef(0)

  const fetchPage = useCallback(
    async (after) => {
      const id = ++reqId.current
      after ? setLoadingMore(true) : setLoading(true)
      setError('')
      try {
        const data = await callAdmin('adminListReports', { sessionToken, status: statusTab, pageSize: 30, cursor: after || undefined })
        if (reqId.current !== id) return
        setReports((prev) => (after ? [...prev, ...(data?.reports || [])] : data?.reports || []))
        setCursor(data?.nextCursor || null)
      } catch (err) {
        if (reqId.current === id) setError(err?.message || 'Could not load reports.')
      } finally {
        if (reqId.current === id) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [sessionToken, statusTab]
  )
  useEffect(() => {
    fetchPage(null)
  }, [fetchPage])

  const resolve = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      await callAdmin('adminResolveReport', { sessionToken, reportId: confirm.id, status: confirm.status, moderationAction: confirm.status })
      setReports((prev) => prev.filter((r) => r.id !== confirm.id))
      setToast({ tone: 'success', message: confirm.status === 'resolved' ? 'Report resolved.' : 'Report dismissed.' })
      if (openId === confirm.id) setOpenId(null)
      setConfirm(null)
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this report. Nothing was changed.' })
    } finally {
      setBusy(false)
    }
  }

  const needle = text.trim().toLowerCase()
  // Type and text filters narrow the loaded pages client-side (the list
  // is already scoped server-side by status); "Load more" fetches further.
  const visible = reports.filter(
    (r) =>
      (!typeFilter || r.targetType === typeFilter || (typeFilter === 'user' && r.targetType === 'profile')) &&
      (!needle || [r.reason, r.details, r.reporter?.displayName, r.reporter?.username, r.targetOwner?.displayName, r.targetOwner?.username].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
  )

  return (
    <div>
      <PageHeader title="Reports" description="Investigate reported content with full context, then resolve or dismiss." />

      <Card padded={false} className="mb-4">
        <div className="px-4 pt-2 flex items-center gap-5 border-b border-gray-100" role="tablist" aria-label="Report status">
          {STATUS_TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={statusTab === k}
              onClick={() => setStatusTab(k)}
              className={`relative py-2.5 text-[13px] font-semibold transition-colors duration-150 ${statusTab === k ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {label}
              {statusTab === k && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-blue-600" />}
            </button>
          ))}
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filter loaded reports by reason, details or person"
              aria-label="Filter reports"
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500"
            />
          </div>
          <select
            aria-label="Content type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-900 outline-none focus:border-blue-500"
          >
            {TYPE_FILTERS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card padded={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPage(null)} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Flag} title={reports.length ? 'No loaded reports match' : statusTab === 'pending' ? 'No pending reports' : `No ${statusTab} reports`} description={reports.length && cursor ? 'Load more to search further back.' : undefined} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((r) => (
              <li key={r.id} className="px-4 py-3.5 flex items-start gap-3">
                <button type="button" onClick={() => setOpenId(r.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-gray-900">{r.reason || 'No reason given'}</span>
                    <Badge>{r.targetType || 'content'}</Badge>
                  </span>
                  {r.details && <span className="block mt-1 text-[13px] text-gray-600 line-clamp-2 break-words">{r.details}</span>}
                  <span className="block mt-1 text-xs text-gray-500">
                    By {who(r.reporter, 'unknown user')} · against {who(r.targetOwner, 'unknown owner')} · {fmtRelative(tsMs(r.createdAt))}
                  </span>
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button variant="ghost" onClick={() => setOpenId(r.id)}>Investigate</Button>
                  {statusTab === 'pending' && (
                    <>
                      <Button className="hidden sm:inline-flex" onClick={() => setConfirm({ id: r.id, status: 'dismissed' })}>Dismiss</Button>
                      <Button className="hidden sm:inline-flex" variant="primary" onClick={() => setConfirm({ id: r.id, status: 'resolved' })}>Resolve</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && cursor && (
          <div className="p-3 border-t border-gray-100 flex justify-center">
            <Button onClick={() => fetchPage(cursor)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
          </div>
        )}
      </Card>

      <Drawer open={Boolean(openId)} title="Investigate report" onClose={() => setOpenId(null)}>
        {openId && (
          <ReportContext
            key={openId}
            reportId={openId}
            onResolve={(status) => setConfirm({ id: openId, status })}
            onOpenUser={(uid) => navigate('users', { openUid: uid })}
            onModerate={() => navigate('moderation')}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.status === 'resolved' ? 'Resolve this report?' : 'Dismiss this report?'}
        body={
          confirm?.status === 'resolved'
            ? 'Marks the report as handled. The content itself is not changed — use Content Moderation to remove it. Recorded in the audit log.'
            : 'Closes the report with no action on the content. Recorded in the audit log.'
        }
        confirmLabel={confirm?.status === 'resolved' ? 'Resolve' : 'Dismiss'}
        busy={busy}
        onConfirm={resolve}
        onCancel={() => setConfirm(null)}
      />
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
