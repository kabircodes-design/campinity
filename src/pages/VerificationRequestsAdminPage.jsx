import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ExternalLink, X } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getCollegeById } from '../data/dummyColleges.js'
import {
  getPendingVerificationRequests,
  getVerificationDocumentUrl,
  reviewVerificationRequest
} from '../firebase/verificationService.js'

/**
 * Same honest-gate pattern as CollegeRequestsAdminPage.jsx: no
 * client-side "am I admin" check exists (platformAdmins/{uid} is
 * locked to if false for all client reads) — the query itself is the
 * real authorization check, and a Firestore permission-denied error
 * is treated as "you don't have access," not a separate failure mode.
 */
export default function VerificationRequestsAdminPage() {
  const navigate = useNavigate()

  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'forbidden' | 'error'
  const [actioningId, setActioningId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [documentUrls, setDocumentUrls] = useState({})

  const load = async () => {
    setStatus('loading')
    try {
      const results = await getPendingVerificationRequests()
      // Enrich with the requester's name/username and college name —
      // both needed for an admin to actually match the ID against the
      // account, per "reviewed against user's account identity...
      // selected college." Best-effort: a failed enrichment for one
      // request doesn't block reviewing the others.
      const enriched = await Promise.all(
        results.map(async (req) => {
          const [profile, college] = await Promise.all([
            getUserProfile(req.uid).catch(() => null),
            req.collegeId ? getCollegeById(req.collegeId).catch(() => null) : Promise.resolve(null)
          ])
          return { ...req, requesterProfile: profile, collegeName: college?.name || '' }
        })
      )
      setRequests(enriched)
      setStatus('success')
    } catch (err) {
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

  const handleViewDocument = async (documentPath) => {
    try {
      const url = await getVerificationDocumentUrl(documentPath)
      setDocumentUrls((prev) => ({ ...prev, [documentPath]: url }))
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError('Could not load the document. Please try again.')
    }
  }

  const handleReview = async (requestId, decision) => {
    if (actioningId) return
    setActioningId(requestId)
    setActionError('')
    try {
      await reviewVerificationRequest(requestId, decision, auth.currentUser?.uid)
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
            <span className="text-base font-bold tracking-tight text-gray-900">Verification Requests</span>
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
            <p className="mt-1 text-sm text-gray-400">Verification review is limited to platform admins.</p>
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
                    <p className="text-sm font-semibold text-gray-900">
                      {req.requesterProfile?.displayName || 'Unknown user'}
                    </p>
                    {req.requesterProfile?.username && (
                      <p className="text-xs text-gray-400">@{req.requesterProfile.username}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">UID: {req.uid}</p>
                    {req.collegeName && <p className="mt-1 text-xs text-gray-500">{req.collegeName}</p>}
                    <button
                      type="button"
                      onClick={() => handleViewDocument(req.documentPath)}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600"
                    >
                      <ExternalLink className="w-3 h-3" /> View submitted document
                    </button>
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
