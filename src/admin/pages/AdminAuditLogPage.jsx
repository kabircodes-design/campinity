import { useCallback, useEffect, useRef, useState } from 'react'
import { History, Search } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { useAdminWorkspace } from '../hooks/useAdminWorkspace.jsx'
import { callAdmin } from '../services/adminCallable.js'
import { ACTION_LABELS, formatAuditWhen } from '../utils/auditLogFormat.js'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui.jsx'

/**
 * Audit log = moderationActions, written ONLY by Cloud Functions
 * (logAdminAction, Admin SDK). Firestore rules give clients no access to
 * that collection at all, so entries can't be forged or edited from the
 * app — the log is server-generated and append-only from the client's
 * point of view. Newest first, cursor-paginated.
 */
const CATEGORY = (a) =>
  /^admin_(login|device|enroll)/.test(a) ? 'access'
    : /report|^resolved$|^dismissed$|content_removed/.test(a) ? 'reports'
      : /verif|achievement|college/.test(a) ? 'verification'
        : /suspend|restrict|user_restored/.test(a) ? 'users'
          : /lostfound|product|community/.test(a) ? 'content'
            : /notification|announcement|notice/.test(a) ? 'communication'
              : 'other'
const CATEGORIES = [
  ['', 'All actions'],
  ['users', 'User moderation'],
  ['reports', 'Reports & content removal'],
  ['verification', 'Verification & approvals'],
  ['content', 'Listings & communities'],
  ['communication', 'Notifications'],
  ['access', 'Admin access']
]

export default function AdminAuditLogPage() {
  const { sessionToken } = useAdminSession()
  const { navigate } = useAdminWorkspace()
  const [entries, setEntries] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('')
  const [text, setText] = useState('')
  const reqId = useRef(0)

  const fetchPage = useCallback(
    async (after) => {
      const id = ++reqId.current
      after ? setLoadingMore(true) : setLoading(true)
      setError('')
      try {
        const data = await callAdmin('adminListAuditLog', { sessionToken, pageSize: 50, cursor: after || undefined })
        if (reqId.current !== id) return
        setEntries((prev) => (after ? [...prev, ...(data?.entries || [])] : data?.entries || []))
        setCursor(data?.nextCursor || null)
      } catch (err) {
        if (reqId.current === id) setError(err?.message || 'Could not load the audit log.')
      } finally {
        if (reqId.current === id) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [sessionToken]
  )
  useEffect(() => {
    fetchPage(null)
  }, [fetchPage])

  const needle = text.trim().toLowerCase()
  const visible = entries.filter(
    (e) =>
      (!category || CATEGORY(e.action) === category) &&
      (!needle || [e.action, ACTION_LABELS[e.action], e.targetType, e.targetId, e.targetUid, e.reason].some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
  )

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every admin action, written by the server. The app cannot create, edit or delete these entries." />

      <Card padded={false} className="mb-4">
        <div className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filter loaded entries by action, ID or reason"
              aria-label="Filter audit entries"
              className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500"
            />
          </div>
          <select
            aria-label="Action category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-900 outline-none focus:border-blue-500"
          >
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card padded={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchPage(null)} />
        ) : visible.length === 0 ? (
          <EmptyState icon={History} title={entries.length ? 'No loaded entries match' : 'No admin actions recorded yet'} description={entries.length && cursor ? 'Load more to search further back.' : undefined} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[13.5px] font-semibold ${e.action === 'admin_login_failed' ? 'text-red-600' : 'text-gray-900'}`}>{ACTION_LABELS[e.action] || e.action}</p>
                    {e.targetType && <Badge>{e.targetType}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 break-all">
                    {[e.targetId && `ID ${e.targetId}`, e.adminUid && `by account ${e.adminUid.slice(0, 8)}…`].filter(Boolean).join(' · ')}
                  </p>
                  {e.reason && <p className="mt-1 text-xs text-gray-600 break-words">{e.reason}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="text-[11.5px] text-gray-500 whitespace-nowrap">{formatAuditWhen(e.createdAt)}</p>
                  {e.targetUid && (
                    <button type="button" onClick={() => navigate('users', { openUid: e.targetUid })} className="text-xs font-semibold text-blue-600">
                      View user
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && cursor && (
          <div className="p-3 border-t border-gray-100 flex justify-center">
            <Button onClick={() => fetchPage(cursor)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load older entries'}</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
