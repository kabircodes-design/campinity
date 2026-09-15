import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'

/**
 * The real, complete Photo Verification flow: user submits an ID
 * document (submitVerificationRequest in verificationService.js,
 * during onboarding's college_id path) → it lands in
 * verificationRequests/{id} with status 'pending' → this page lists
 * those via adminListVerificationRequests, opens the actual document
 * via a short-lived signed URL (adminGetVerificationDocumentUrl), and
 * Verify/Dismiss calls adminReviewVerificationRequest, which flips
 * users/{uid}.verifiedCampus to true on approval and always writes an
 * audit-log entry. All three Cloud Functions are session-token gated —
 * the same real security boundary as Reports, not a UI-only guard.
 */
export default function AdminPhotoVerificationPage() {
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
    callAdmin('adminListVerificationRequests', { sessionToken, pageSize: 30 })
      .then((data) => setRequests(data?.requests || []))
      .catch((err) => setError(err?.message || 'Could not load verification requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken])

  const handleViewDocument = async (documentPath) => {
    try {
      const data = await callAdmin('adminGetVerificationDocumentUrl', { sessionToken, documentPath })
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not load the document.' })
    }
  }

  const handleReview = async (req, decision) => {
    if (actioningId) return
    setActioningId(req.id)
    setConfirmTarget(null)
    try {
      await callAdmin('adminReviewVerificationRequest', { sessionToken, requestId: req.id, decision })
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
      setToast({ tone: 'success', message: decision === 'approved' ? 'Verification approved.' : 'Verification dismissed.' })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this request.' })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Photo Verification</h1>
      <p className="mt-1 text-sm text-gray-400">Review submitted ID documents and verify campus identity.</p>

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
            <p className="mt-1 text-sm text-gray-400">No pending photo verifications right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {requests.map((req) => (
              <div key={req.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{req.displayName}</p>
                    {req.username && <p className="text-xs text-gray-400">@{req.username}</p>}
                    {req.collegeName && <p className="mt-1 text-xs text-gray-500">{req.collegeName}</p>}
                    <p className="mt-1 text-[11px] text-gray-300">UID: {req.uid}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-600">
                    Pending
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleViewDocument(req.documentPath)}
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-600"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View submitted document
                </button>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ req, decision: 'approved' })}
                    disabled={actioningId === req.id}
                    className="rounded-full bg-blue-600 text-white text-xs font-semibold px-3.5 py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmTarget({ req, decision: 'rejected' })}
                    disabled={actioningId === req.id}
                    className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-3.5 py-1.5 hover:border-gray-300 disabled:opacity-50 transition-all duration-200"
                  >
                    Dismiss
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
              {confirmTarget.decision === 'approved' ? `Verify ${confirmTarget.req.displayName}?` : `Dismiss this request?`}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">
              {confirmTarget.decision === 'approved'
                ? "This marks the user's campus as verified."
                : 'This request will be marked rejected. The user remains unverified.'}
            </p>
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
