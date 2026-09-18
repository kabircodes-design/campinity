import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'
import VerificationReviewModal from '../components/VerificationReviewModal.jsx'

/**
 * The real, complete Photo Verification flow: user submits an ID
 * document (submitVerificationRequest in verificationService.js,
 * during onboarding's college_id path) → it lands in
 * verificationRequests/{id} with status 'pending' → this page lists
 * those via adminListVerificationRequests → opens the actual document
 * in a proper in-app review screen (VerificationReviewModal — zoom,
 * rotate, next/prev, replacing the previous window.open which sent the
 * admin out of the panel entirely) → Approve/Reject calls
 * adminReviewVerificationRequest, which flips users/{uid}.verifiedCampus
 * to true on approval and always writes an audit-log entry. All three
 * Cloud Functions are session-token gated — the same real security
 * boundary as Reports, not a UI-only guard.
 */
export default function AdminPhotoVerificationPage() {
  const { sessionToken } = useAdminSession()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [activeIndex, setActiveIndex] = useState(null)
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

  const activeRequest = activeIndex !== null ? requests[activeIndex] : null

  const handleReview = async (decision, reason) => {
    const req = activeRequest
    if (!req || actioningId) return
    setActioningId(req.id)
    try {
      await callAdmin('adminReviewVerificationRequest', { sessionToken, requestId: req.id, decision, reason })
      const remaining = requests.filter((r) => r.id !== req.id)
      setRequests(remaining)
      setToast({ tone: 'success', message: decision === 'approved' ? 'Verification approved.' : 'Verification rejected.' })
      // Stay in the reviewer, landing on whichever request now occupies
      // this same position (or close if the queue is now empty) — keeps
      // an admin working through a queue from having to reopen each one.
      if (remaining.length === 0) setActiveIndex(null)
      else setActiveIndex(Math.min(activeIndex, remaining.length - 1))
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
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 h-[86px] animate-pulse" />
            ))}
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
            <ImageOff className="w-5 h-5 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-gray-900">You're all caught up.</p>
            <p className="mt-1 text-sm text-gray-400">No pending photo verifications right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {requests.map((req, i) => (
              <button
                key={req.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{req.displayName}</p>
                    {req.username && <p className="text-xs text-gray-400">@{req.username}</p>}
                    {req.collegeName && <p className="mt-1 text-xs text-gray-500">{req.collegeName}</p>}
                  </div>
                  <span className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-600">
                    Pending
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeRequest && (
        <VerificationReviewModal
          sessionToken={sessionToken}
          request={activeRequest}
          index={activeIndex}
          total={requests.length}
          busy={actioningId === activeRequest.id}
          onClose={() => setActiveIndex(null)}
          onPrev={activeIndex > 0 ? () => setActiveIndex(activeIndex - 1) : null}
          onNext={activeIndex < requests.length - 1 ? () => setActiveIndex(activeIndex + 1) : null}
          onApprove={() => handleReview('approved')}
          onReject={(reason) => handleReview('rejected', reason)}
        />
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
