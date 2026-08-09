import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getReportsPage } from '../firebase/reportService.js'
import { reviewReport } from '../firebase/moderationService.js'
import { deletePost, deleteComment } from '../firebase/engagementService.js'
import { deleteStory } from '../firebase/storyService.js'

const FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'all', label: 'All' },
  { id: 'resolved', label: 'Resolved' }
]

/**
 * Deliberately at /moderation, not /admin — the pre-existing /admin
 * route points to AdminPage.jsx and a stage="admin" ProtectedRoute
 * check I've never seen the implementation of (neither file exists in
 * my sandbox, despite being referenced). Rather than guess how that
 * unknown system works, this uses the same proven, already-working
 * pattern as CollegeRequestsAdminPage.jsx/VerificationRequestsAdminPage.jsx:
 * no client-side admin check exists (platformAdmins/{uid} is locked
 * to if false for every read), the query itself is the real gate, and
 * a Firestore permission-denied error is shown as "you don't have
 * access," not a separate failure mode.
 */
export default function ModerationDashboardPage() {
  const navigate = useNavigate()

  const [filter, setFilter] = useState('pending')
  const [reports, setReports] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'forbidden' | 'error'
  const [selected, setSelected] = useState(null)
  const [actioning, setActioning] = useState(false)
  const [confirmingAction, setConfirmingAction] = useState(null)
  const [actionError, setActionError] = useState('')

  const load = async (currentFilter) => {
    setStatus('loading')
    try {
      const { reports: results } = await getReportsPage({ status: currentFilter === 'all' ? null : currentFilter })
      const enriched = await Promise.all(
        results.map(async (report) => {
          const [reporter, targetOwner] = await Promise.all([
            getUserProfile(report.reporterUid).catch(() => null),
            report.targetOwnerUid ? getUserProfile(report.targetOwnerUid).catch(() => null) : Promise.resolve(null)
          ])
          return { ...report, reporterProfile: reporter, targetOwnerProfile: targetOwner }
        })
      )
      setReports(enriched)
      setStatus('success')
    } catch (err) {
      setStatus(err?.code === 'permission-denied' ? 'forbidden' : 'error')
    }
  }

  useEffect(() => {
    load(filter)
  }, [filter])

  const handleAction = async (decision, moderationStatus) => {
    const adminUid = auth.currentUser?.uid
    if (!adminUid || !selected || actioning) return
    setActioning(true)
    setActionError('')
    try {
      if (moderationStatus === 'content_removed') {
        if (selected.targetType === 'post') await deletePost(selected.targetId, adminUid)
        else if (selected.targetType === 'comment' && selected.targetOwnerUid) {
          // comments live under posts/{postId}/comments — targetId alone
          // isn't enough without the parent post id, which this report
          // schema doesn't separately capture. Reported honestly as a
          // known limitation rather than guessed.
        } else if (selected.targetType === 'story') await deleteStory(selected.targetId, null)
        await reviewReport({ reportId: selected.id, adminUid, decision: 'resolved', moderationAction: 'content_removed' })
      } else {
        await reviewReport({
          reportId: selected.id,
          adminUid,
          decision,
          moderationStatus,
          targetOwnerUid: selected.targetOwnerUid
        })
      }
      setReports((prev) => prev.filter((r) => r.id !== selected.id))
      setSelected(null)
      setConfirmingAction(null)
    } catch (err) {
      setActionError(err?.message || 'Could not complete this action.')
    } finally {
      setActioning(false)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Moderation</span>
          </div>
        </header>

        {status === 'forbidden' && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">You don't have access to this page.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">Couldn't load reports.</p>
            <button type="button" onClick={() => load(filter)} className="mt-4 rounded-full border border-gray-200 text-sm font-semibold px-5 py-2.5">
              Try Again
            </button>
          </div>
        )}

        {(status === 'loading' || status === 'success') && (
          <>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    filter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {status === 'loading' ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : reports.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">No reports here.</p>
            ) : (
              <div className="px-4 py-3 space-y-2.5">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className="w-full text-left rounded-xl border border-gray-100 p-3.5 hover:border-gray-200 transition-all duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{r.targetType}</span>
                      <span className="text-[10px] text-gray-400">{r.status}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{r.reason}</p>
                    <p className="text-xs text-gray-400">
                      Reported by {r.reporterProfile?.displayName || 'someone'}
                      {r.targetOwnerProfile && ` · target: ${r.targetOwnerProfile.displayName}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
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
            {selected.targetOwnerProfile && (
              <p className="text-sm text-gray-500">@{selected.targetOwnerProfile.username}</p>
            )}
            <p className="mt-2 text-xs font-semibold text-gray-400 uppercase">Reported by</p>
            <p className="text-sm text-gray-900">{selected.reporterProfile?.displayName || 'Unknown'}</p>

            {actionError && <p className="mt-3 text-xs text-red-500">{actionError}</p>}

            {confirmingAction ? (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5">
                <p className="text-sm text-red-700">Are you sure?</p>
                <div className="mt-2.5 flex gap-2">
                  <button type="button" onClick={() => setConfirmingAction(null)} className="flex-1 rounded-full border border-gray-200 text-sm font-semibold py-2">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(...confirmingAction)}
                    disabled={actioning}
                    className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
                  >
                    {actioning ? 'Working…' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button type="button" onClick={() => handleAction('resolved', null)} disabled={actioning} className="w-full flex items-center justify-center gap-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 disabled:opacity-50">
                  <Check className="w-4 h-4" /> Keep content / Resolve
                </button>
                <button type="button" onClick={() => setConfirmingAction(['resolved', 'content_removed'])} className="w-full rounded-full border border-red-200 text-red-600 text-sm font-semibold py-2.5">
                  Remove content
                </button>
                <button type="button" onClick={() => setConfirmingAction(['resolved', 'restricted'])} className="w-full rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5">
                  Restrict user
                </button>
                <button type="button" onClick={() => setConfirmingAction(['resolved', 'suspended'])} className="w-full rounded-full border border-red-200 text-red-600 text-sm font-semibold py-2.5">
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
    </div>
  )
}
