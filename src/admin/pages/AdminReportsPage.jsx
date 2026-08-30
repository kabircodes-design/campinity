import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAdminSession } from '../hooks/useAdminSession.jsx'

const STATUS_TABS = ['pending', 'resolved', 'dismissed']

/**
 * REBUILT for the new architecture. Both listing and resolving now go
 * through session-token-verified Cloud Functions (adminListReports,
 * adminResolveReport) instead of the client SDK directly — the
 * client SDK path (reportService.js) is still gated by
 * firestore.rules' platformAdmins check, which a trusted friend using
 * only the admin password won't have. This is the correct fix, not
 * just fixing the write side.
 */
export default function AdminReportsPage() {
  const { sessionToken } = useAdminSession()
  const [statusTab, setStatusTab] = useState('pending')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const listReports = httpsCallable(getFunctions(), 'adminListReports')
  const resolveReportFn = httpsCallable(getFunctions(), 'adminResolveReport')

  const load = () => {
    setLoading(true)
    setError('')
    listReports({ sessionToken, status: statusTab, pageSize: 30 })
      .then((result) => setReports(result.data?.reports || []))
      .catch((err) => setError(err?.message || 'Could not load reports.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusTab])

  const handleAction = async (report, status) => {
    if (actioningId) return
    setActioningId(report.id)
    setConfirmTarget(null)
    try {
      await resolveReportFn({ sessionToken, reportId: report.id, status, moderationAction: status })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch (err) {
      setError(err?.message || 'Could not update this report.')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Reports</h1>
      <p className="mt-1 text-sm text-gray-400">Review and resolve reported content.</p>

      <div className="mt-5 flex items-center gap-4 border-b border-gray-100">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusTab(tab)}
            className={`relative py-2.5 text-[13px] font-semibold capitalize transition-colors duration-200 ${
              statusTab === tab ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
            {statusTab === tab && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-blue-600" />}
          </button>
        ))}
      </div>

      <div className="mt-4">
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
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">You're all caught up.</p>
            <p className="mt-1 text-sm text-gray-400">No {statusTab} reports right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {reports.map((report) => (
              <div key={report.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{report.reason}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {report.targetType} · reported by {report.reporterUid}
                    </p>
                    {report.details && <p className="mt-2 text-sm text-gray-600">{report.details}</p>}
                  </div>
                  <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-500 capitalize">
                    {report.status}
                  </span>
                </div>

                {statusTab === 'pending' && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({ report, status: 'resolved' })}
                      disabled={actioningId === report.id}
                      className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3.5 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({ report, status: 'dismissed' })}
                      disabled={actioningId === report.id}
                      className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-3.5 py-1.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => setConfirmTarget(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {confirmTarget.status === 'resolved' ? 'Resolve this report?' : 'Dismiss this report?'}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">This action cannot be undone.</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAction(confirmTarget.report, confirmTarget.status)}
                className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
