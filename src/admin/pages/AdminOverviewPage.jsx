import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAdminSession } from '../hooks/useAdminSession.jsx'

/**
 * REBUILT — now calls adminListReports (session-token verified,
 * Admin SDK) instead of the client-SDK getReportsPage, which would
 * silently return wrong/empty results for a trusted friend without a
 * platformAdmins entry. Every other card still shows Unavailable
 * rather than a fabricated number, unchanged from before.
 */
const CARDS = [
  { key: 'reports', label: 'Pending Reports' },
  { key: 'photos', label: 'Pending Photo Reviews' },
  { key: 'college', label: 'Pending College Requests' },
  { key: 'verification', label: 'Pending User Verification' },
  { key: 'moderation', label: 'Open Moderation Cases' },
  { key: 'lostFound', label: 'Open Lost & Found Cases' }
]

export default function AdminOverviewPage() {
  const { sessionToken } = useAdminSession()
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const listReports = httpsCallable(getFunctions(), 'adminListReports')
    listReports({ sessionToken, status: 'pending', pageSize: 50 })
      .then((result) => {
        if (!cancelled) setCounts((prev) => ({ ...prev, reports: (result.data?.reports || []).length }))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionToken])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>
      <p className="mt-1 text-sm text-gray-400">Here's what needs your attention.</p>

      <div className="mt-5 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ key, label }) => (
          <div key={key} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">
              {key === 'reports' ? (loading ? '—' : (counts.reports ?? 0)) : (
                <span className="text-sm font-medium text-gray-300">Unavailable</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
