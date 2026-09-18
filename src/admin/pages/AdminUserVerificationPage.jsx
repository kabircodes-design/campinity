import { useState } from 'react'
import { Ban, Search, ShieldCheck, ShieldOff } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import { searchStudents } from '../../firebase/searchService.js'
import AdminToast from '../components/AdminToast.jsx'

const MODERATION_LABELS = {
  restricted: { label: 'Restricted', tone: 'bg-amber-50 text-amber-600' },
  suspended: { label: 'Suspended', tone: 'bg-red-50 text-red-600' }
}

/**
 * Deliberately distinct from Photo Verification: that section reviews
 * the QUEUE of pending ID-document submissions. This is a direct
 * search over the real `users` collection (reusing searchStudents —
 * the same search the real Search page uses, not a second search
 * system) so an admin can look up any specific student and see/adjust
 * their verification status directly — for edge cases outside the
 * normal submission queue (e.g. a student who verified a different
 * way, or a correction). The search itself needs no Cloud Function
 * (users/{uid} is already client-readable); only the write
 * (adminSetUserVerification) is session-token gated.
 */
export default function AdminUserVerificationPage() {
  const { sessionToken } = useAdminSession()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [actioningUid, setActioningUid] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [toast, setToast] = useState(null)

  const handleSearch = async (event) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setSearching(true)
    setError('')
    try {
      const students = await searchStudents(trimmed)
      setResults(students)
    } catch (err) {
      setError(err?.message || 'Could not search students.')
    } finally {
      setSearching(false)
    }
  }

  const handleToggle = async (student, verified) => {
    if (actioningUid) return
    setActioningUid(student.uid)
    setConfirmTarget(null)
    try {
      await callAdmin('adminSetUserVerification', { sessionToken, uid: student.uid, verified })
      setResults((prev) => prev.map((s) => (s.uid === student.uid ? { ...s, verifiedCampus: verified } : s)))
      setToast({ tone: 'success', message: verified ? `${student.name} is now verified.` : `${student.name} is no longer verified.` })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this user.' })
    } finally {
      setActioningUid(null)
    }
  }

  // Same adminModerateContent action set (restricted/suspended) a report
  // can already trigger, reachable here without needing a report first —
  // adminSetUserModerationStatus writes the exact same
  // users/{uid}.moderationStatus field.
  const handleModerate = async (student, status) => {
    if (actioningUid) return
    setActioningUid(student.uid)
    setConfirmTarget(null)
    try {
      await callAdmin('adminSetUserModerationStatus', { sessionToken, uid: student.uid, status })
      setResults((prev) => prev.map((s) => (s.uid === student.uid ? { ...s, moderationStatus: status === 'active' ? null : status } : s)))
      setToast({
        tone: 'success',
        message: status === 'active' ? `${student.name} restored to good standing.` : `${student.name} is now ${status}.`
      })
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not update this user.' })
    } finally {
      setActioningUid(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">User Verification</h1>
      <p className="mt-1 text-sm text-gray-400">Look up a student and review or adjust their campus verification status.</p>

      <form onSubmit={handleSearch} className="mt-5 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username, course or year..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
        />
      </form>

      <div className="mt-5">
        {searching ? (
          <div className="py-16 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        ) : results === null ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-400">Search for a student to view their verification status.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-gray-900">No students found.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((student) => {
              const modInfo = student.moderationStatus ? MODERATION_LABELS[student.moderationStatus] : null
              return (
                <div key={student.uid} className="rounded-xl border border-gray-100 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        @{student.username}
                        {student.course && ` · ${student.course}`}
                        {student.year && ` · ${student.year}`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            student.verifiedCampus ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {student.verifiedCampus ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                          {student.verifiedCampus ? 'Verified' : 'Not verified'}
                        </span>
                        {modInfo && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${modInfo.tone}`}>
                            <Ban className="w-3 h-3" /> {modInfo.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmTarget({ kind: 'verification', student, verified: !student.verifiedCampus })}
                      disabled={actioningUid === student.uid}
                      className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 disabled:opacity-50 ${
                        student.verifiedCampus
                          ? 'border border-gray-200 text-gray-600 hover:border-gray-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {student.verifiedCampus ? 'Revoke' : 'Verify'}
                    </button>
                  </div>

                  {/* Moderation actions — same restricted/suspended states a
                      report can already trigger via adminModerateContent,
                      now reachable directly from a user lookup. */}
                  <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1.5 flex-wrap">
                    {student.moderationStatus ? (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget({ kind: 'moderation', student, status: 'active' })}
                        disabled={actioningUid === student.uid}
                        className="rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 text-[11px] font-semibold px-3 py-1.5 disabled:opacity-50 transition-all duration-200"
                      >
                        Restore to good standing
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ kind: 'moderation', student, status: 'restricted' })}
                          disabled={actioningUid === student.uid}
                          className="rounded-full border border-amber-200 text-amber-600 hover:bg-amber-50 text-[11px] font-semibold px-3 py-1.5 disabled:opacity-50 transition-all duration-200"
                        >
                          Restrict
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ kind: 'moderation', student, status: 'suspended' })}
                          disabled={actioningUid === student.uid}
                          className="rounded-full border border-red-200 text-red-600 hover:bg-red-50 text-[11px] font-semibold px-3 py-1.5 disabled:opacity-50 transition-all duration-200"
                        >
                          Suspend
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {confirmTarget && confirmTarget.kind === 'verification' && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button type="button" aria-label="Cancel" onClick={() => setConfirmTarget(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {confirmTarget.verified ? `Verify ${confirmTarget.student.name}?` : `Revoke ${confirmTarget.student.name}'s verification?`}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">This directly updates their campus verification status.</p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setConfirmTarget(null)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleToggle(confirmTarget.student, confirmTarget.verified)}
                className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-2"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmTarget && confirmTarget.kind === 'moderation' && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <button type="button" aria-label="Cancel" onClick={() => setConfirmTarget(null)} className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">
              {confirmTarget.status === 'active'
                ? `Restore ${confirmTarget.student.name} to good standing?`
                : `${confirmTarget.status === 'suspended' ? 'Suspend' : 'Restrict'} ${confirmTarget.student.name}?`}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">
              {confirmTarget.status === 'active'
                ? 'This clears their restricted/suspended status.'
                : 'This directly updates their account moderation status.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setConfirmTarget(null)} className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleModerate(confirmTarget.student, confirmTarget.status)}
                className={`flex-1 rounded-full text-white text-sm font-semibold py-2 ${
                  confirmTarget.status === 'active' ? 'bg-blue-600' : 'bg-red-600'
                }`}
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
