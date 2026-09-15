import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

const STATUS_TABS = ['pending', 'resolved', 'dismissed']

/**
 * The richer moderation action set ModerationDashboardPage.jsx (the
 * older, platformAdmins-gated /moderation route) already modeled —
 * content_removed/restricted/suspended, not just resolve/dismiss —
 * brought into this session-token-gated panel via adminModerateContent.
 * Reads the SAME reports/{reportId} queue AdminReportsPage.jsx already
 * serves (adminListReports) — this is a richer action panel on the
 * same real data, not a second report system.
 */
export default function AdminModerationPage() {
  const { sessionToken } = useAdminSession()
  const [statusTab, setStatusTab] = useState('pending')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [actioning, setActioning] = useState(false)
  const [confirmingAction, setConfirmingAction] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListReports', { sessionToken, status: statusTab, pageSize: 30 })
      .then((data) => setReports(data?.reports || []))
      .catch((err) => setError(err?.message || 'Could not load reports.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusTab])

  const handleAction = async (moderationAction) => {
    if (!selected || actioning) return
    setActioning(true)
    try {
      await callAdmin('adminModerateContent', {
        sessionToken,
        reportId: selected.id,
        moderationAction,
        targetType: selected.targetType,
        targetId: selected.targetId,
        targetOwnerUid: selected.targetOwnerUid || null
      })
      setReports((prev) => prev.filter((r) => r.id !== selected.id))
      setSelected(null)
      setConfirmingAction(null)
      setToast({ tone: 'success', message: 'Report updated.' })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not complete this action.' })
    } finally {
      setActioning(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Moderation</h1>
      <p className="mt-1 text-sm text-gray-400">Take real action on reported content — remove it, or restrict/suspend a user.</p>

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
            <p className="text-sm font-semibold text-gray-900">No reports here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => statusTab === 'pending' && setSelected(r)}
                className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 transition-all duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{r.targetType}</span>
                  <span className="text-[10px] text-gray-400 capitalize">{r.status}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">{r.reason}</p>
                <p className="text-xs text-gray-400">reported by {r.reporterUid}</p>
                {r.details && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{r.details}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-end sm:items-center justify-center">
          <button type="button" aria-label="Close" onClick={() => !actioning && setSelected(null)} className="absolute inset-0" />
          <div className="relative w-full sm:max-w-[420px] bg-white rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
            <p className="text-base font-bold text-gray-900">Report</p>
            <p className="mt-3 text-xs font-semibold text-gray-400 uppercase">Reason</p>
            <p className="text-sm text-gray-900">{selected.reason}</p>
            {selected.details && (
              <>
                <p className="mt-2 text-xs font-semibold text-gray-400 uppercase">Details</p>
                <p className="text-sm text-gray-700">{selected.details}</p>
              </>
            )}
            <p className="mt-2 text-xs font-semibold text-gray-400 uppercase">Target</p>
            <p className="text-sm text-gray-900">{selected.targetType} · {selected.targetId}</p>
            <p className="mt-2 text-xs font-semibold text-gray-400 uppercase">Reported by</p>
            <p className="text-sm text-gray-900">{selected.reporterUid}</p>

            {confirmingAction ? (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5">
                <p className="text-sm text-red-700">Are you sure?</p>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => setConfirmingAction(null)} className="flex-1 rounded-full border border-gray-200 text-sm font-semibold py-2">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(confirmingAction)}
                    disabled={actioning}
                    className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
                  >
                    {actioning ? 'Working…' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button type="button" onClick={() => handleAction('resolved')} disabled={actioning} className="w-full flex items-center justify-center gap-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 disabled:opacity-50">
                  <Check className="w-4 h-4" /> Keep content / Resolve
                </button>
                <button type="button" onClick={() => handleAction('dismissed')} disabled={actioning} className="w-full flex items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 disabled:opacity-50">
                  <X className="w-4 h-4" /> Dismiss report
                </button>
                <button type="button" onClick={() => setConfirmingAction('content_removed')} className="w-full rounded-full border border-red-200 text-red-600 text-sm font-semibold py-2.5">
                  Remove content
                </button>
                <button type="button" onClick={() => setConfirmingAction('restricted')} className="w-full rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5">
                  Restrict user
                </button>
                <button type="button" onClick={() => setConfirmingAction('suspended')} className="w-full rounded-full border border-red-200 text-red-600 text-sm font-semibold py-2.5">
                  Suspend user
                </button>
              </div>
            )}

            <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="absolute top-4 right-4 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
