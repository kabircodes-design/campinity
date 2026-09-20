import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'
import AchievementReviewModal from '../components/AchievementReviewModal.jsx'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' }
]

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-600',
  approved: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-red-50 text-red-600'
}

/**
 * Verified Campus Certificates review — the same real flow as Photo
 * Verification (AdminPhotoVerificationPage.jsx), copied structurally:
 * list -> open in AchievementReviewModal -> Approve/Reject via
 * adminReviewAchievementSubmission. Approval doesn't just flag the
 * submission — it creates the OFFICIAL users/{uid}/verifiedAchievements
 * record (see the Cloud Function), which is what actually shows up as
 * a "Verified Campus Achievement" on the student's profile.
 */
export default function AdminAchievementVerificationPage() {
  const { sessionToken } = useAdminSession()
  const [status, setStatus] = useState('pending')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [activeIndex, setActiveIndex] = useState(null)
  const [toast, setToast] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    callAdmin('adminListAchievementSubmissions', { sessionToken, status, pageSize: 30 })
      .then((data) => setSubmissions(data?.submissions || []))
      .catch((err) => setError(err?.message || 'Could not load achievement submissions.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken, status])

  const activeSubmission = activeIndex !== null ? submissions[activeIndex] : null

  const handleReview = async (decision, reason) => {
    const sub = activeSubmission
    if (!sub || actioningId) return
    setActioningId(sub.id)
    try {
      await callAdmin('adminReviewAchievementSubmission', { sessionToken, uid: sub.uid, submissionId: sub.id, decision, reason })
      const remaining = submissions.filter((s) => s.id !== sub.id)
      setSubmissions(remaining)
      setToast({ tone: 'success', message: decision === 'approved' ? 'Achievement verified.' : 'Submission rejected.' })
      if (remaining.length === 0) setActiveIndex(null)
      else setActiveIndex(Math.min(activeIndex, remaining.length - 1))
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this submission.' })
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Achievement Verification</h1>
      <p className="mt-1 text-sm text-gray-400">Review student-submitted certificates and verify official achievements.</p>

      <div className="mt-4 flex items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatus(tab.key)}
            className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
              status === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center">
            <Award className="w-5 h-5 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-gray-900">Nothing here yet.</p>
            <p className="mt-1 text-sm text-gray-400">No {status} achievement submissions right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {submissions.map((sub, i) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{sub.title}</p>
                    <p className="text-xs text-gray-400">{sub.displayName}{sub.username ? ` · @${sub.username}` : ''}</p>
                    {sub.collegeName && <p className="mt-1 text-xs text-gray-500">{sub.collegeName}</p>}
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[sub.status] || STATUS_STYLES.pending}`}>
                    {sub.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeSubmission && (
        <AchievementReviewModal
          sessionToken={sessionToken}
          submission={activeSubmission}
          index={activeIndex}
          total={submissions.length}
          busy={actioningId === activeSubmission.id}
          readOnly={status !== 'pending'}
          onClose={() => setActiveIndex(null)}
          onPrev={activeIndex > 0 ? () => setActiveIndex(activeIndex - 1) : null}
          onNext={activeIndex < submissions.length - 1 ? () => setActiveIndex(activeIndex + 1) : null}
          onApprove={() => handleReview('approved')}
          onReject={(reason) => handleReview('rejected', reason)}
        />
      )}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
