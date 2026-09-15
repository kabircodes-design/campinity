import { useEffect, useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAdminSession } from '../hooks/useAdminSession.jsx'

/**
 * REBUILT again — now calls adminGetOverviewCounts, a single Cloud
 * Function doing real Firestore count() aggregations (one small read
 * per collection, not a full document fetch) for every card below.
 * Every number here is real; nothing is fabricated. If the call itself
 * fails, every card shows "Unavailable" rather than a stale or fake 0.
 */
const CARDS = [
  { key: 'reports', label: 'Pending Reports' },
  { key: 'verification', label: 'Pending Photo Verifications' },
  { key: 'college', label: 'Pending College Requests' },
  { key: 'lostFound', label: 'Active Lost & Found' },
  { key: 'totalUsers', label: 'Total Users' },
  { key: 'verifiedUsers', label: 'Verified Users' }
]

export default function AdminOverviewPage() {
  const { sessionToken } = useAdminSession()
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    const getCounts = httpsCallable(getFunctions(), 'adminGetOverviewCounts')
    getCounts({ sessionToken })
      .then((result) => setCounts(result.data || {}))
      .catch((err) => setError(err?.message || 'Could not load overview stats.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [sessionToken])

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900">Overview</h1>
      <p className="mt-1 text-sm text-gray-400">Here's what needs your attention.</p>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3 flex items-center justify-between">
          {error}
          <button type="button" onClick={load} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(({ key, label }) => (
          <div key={key} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900">
              {loading ? (
                <span className="inline-block w-8 h-6 rounded bg-gray-100 animate-pulse" />
              ) : counts && counts[key] !== undefined ? (
                counts[key]
              ) : (
                <span className="text-sm font-medium text-gray-300">Unavailable</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
