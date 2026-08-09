import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, MapPin, X } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { getPendingCollegeRequests, reviewCollegeRequest } from '../firebase/collegeRequestService.js'

/**
 * No client-side admin check exists before rendering this page — see
 * collegeRequestService.js's own docstring for why that's intentional.
 * The query itself is the real gate: a non-admin's fetch fails with a
 * Firestore permission error, which this page shows as "You don't
 * have access to this page," not a blank screen or a crash.
 */
export default function CollegeRequestsAdminPage() {
  const navigate = useNavigate()

  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'forbidden' | 'error'
  const [actioningId, setActioningId] = useState(null)
  const [actionError, setActionError] = useState('')

  const load = async () => {
    setStatus('loading')
    try {
      const results = await getPendingCollegeRequests()
      setRequests(results)
      setStatus('success')
    } catch (err) {
      // Firestore permission-denied is the honest signal for "you are
      // not an admin" — there's no separate check to have failed
      // earlier, this IS the check.
      if (err?.code === 'permission-denied') {
        setStatus('forbidden')
      } else {
        setStatus('error')
      }
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleReview = async (requestId, decision) => {
    if (actioningId) return
    setActioningId(requestId)
    setActionError('')
    try {
      await reviewCollegeRequest(requestId, decision)
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
    } catch (err) {
      setActionError(err?.message || 'Could not update this request. Please try again.')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">College Requests</span>
          </div>
        </header>

        {status === 'loading' && (
          <div className="py-16 flex justify-center">
            <Loader size="md" tone="dark" />
          </div>
        )}

        {status === 'forbidden' && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">You don't have access to this page.</p>
            <p className="mt-1 text-sm text-gray-400">College request review is limited to platform admins.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">Couldn't load requests.</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2.5 hover:border-gray-300 transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="px-4 py-4">
            {actionError && (
              <p className="mb-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                {actionError}
              </p>
            )}
            {requests.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No pending requests.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-gray-100 p-4">
                    <p className="text-sm font-semibold text-gray-900">{req.name}</p>
                    {req.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" /> {req.location}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReview(req.id, 'approved')}
                        disabled={actioningId === req.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold py-2 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(req.id, 'rejected')}
                        disabled={actioningId === req.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-600 text-xs font-semibold py-2 disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
