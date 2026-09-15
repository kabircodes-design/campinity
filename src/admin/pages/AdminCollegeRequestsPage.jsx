import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

/**
 * Real college-request review, via adminListCollegeRequests/
 * adminReviewCollegeRequest — the same slug-dedup approval logic
 * collegeRequestService.js's reviewCollegeRequest already established
 * (a college is only ever created once per name, never duplicated or
 * overwritten), now reachable by a password-only admin session.
 */
export default function AdminCollegeRequestsPage() {
  const { sessionToken } = useAdminSession()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListCollegeRequests', { sessionToken, pageSize: 30 })
      .then((data) => setRequests(data?.requests || []))
      .catch((err) => setError(err?.message || 'Could not load college requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken])

  const handleReview = async (req, decision) => {
    if (actioningId) return
    setActioningId(req.id)
    setConfirmTarget(null)
    try {
      await callAdmin('adminReviewCollegeRequest', { sessionToken, requestId: req.id, decision })
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      setToast({ tone: 'success', message: decision === 'approved' ? 'College request approved.' : 'College request rejected.' })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this request.' })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">College Requests</h1>
      <p className="mt-1 text-sm text-gray-400">Review student requests to add a missing college.</p>

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
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">You're all caught up.</p>
            <p className="mt-1 text-sm text-gray-400">No pending college requests right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {requests.map((req) => (
              <div key={req.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">{req.name}</p>
                {req.location && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="w-3 h-3" /> {req.location}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ req, decision: 'approved' })}
                    disabled={actioningId === req.id}
                    className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3.5 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ req, decision: 'rejected' })}
                    disabled={actioningId === req.id}
                    className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-3.5 py-1.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmTarget && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button type="button" aria-label="Cancel" onClick={() => setConfirmTarget(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {confirmTarget.decision === 'approved' ? `Add "${confirmTarget.req.name}"?` : 'Reject this request?'}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">This action cannot be undone.</p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setConfirmTarget(null)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReview(confirmTarget.req, confirmTarget.decision)}
                className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
