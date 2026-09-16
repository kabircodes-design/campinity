import { useEffect, useState } from 'react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import { ACTION_LABELS, formatAuditWhen } from '../utils/auditLogFormat.js'

/**
 * Real read side of every logAdminAction() call across all the new
 * admin functions above (verification, college requests, moderation,
 * Lost & Found, Marketplace, notifications) plus reviewReport's own
 * pre-existing logModerationAction() writes — one audit trail, not a
 * separate log per feature.
 */
export default function AdminAuditLogPage() {
  const { sessionToken } = useAdminSession()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListAuditLog', { sessionToken, pageSize: 100 })
      .then((data) => setEntries(data?.entries || []))
      .catch((err) => setError(err?.message || 'Could not load the audit log.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
      <p className="mt-1 text-sm text-gray-400">Every meaningful admin action, in order.</p>

      <div className="mt-5">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">{error}</p>
            <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-blue-600">
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">No admin actions recorded yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">{ACTION_LABELS[entry.action] || entry.action}</p>
                  <p className="flex-shrink-0 text-[11px] text-gray-400">{formatAuditWhen(entry.createdAt)}</p>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {entry.targetType && `${entry.targetType}`}
                  {entry.targetId && ` · ${entry.targetId}`}
                  {entry.targetUid && ` · user ${entry.targetUid}`}
                </p>
                {entry.reason && <p className="mt-1 text-xs text-gray-500">{entry.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
