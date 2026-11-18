import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, CircleHelp, RefreshCw, ServerCrash } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatTile, fmtNumber, fmtRelative } from '../components/ui.jsx'

/**
 * System Health — only signals that are actually collected:
 * adminGetSystemHealth reads Cloud Logging for the deployed Cloud
 * Functions over the last 24h (request records with HTTP status and
 * latency, plus ERROR-level log entries). It does not cover client-side
 * crashes, Firestore/Storage quotas, billing or uptime from outside —
 * that's said plainly instead of implying a full health check.
 *
 * If the logs can't be read (most likely: the functions service account
 * lacks roles/logging.viewer), the page says so and shows NO verdict.
 */
const pct = (num, den) => (den > 0 ? `${((num / den) * 100).toFixed(num / den < 0.01 ? 2 : 1)}%` : '—')
const ms = (v) => (typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`) : '—')

export default function AdminSystemHealthPage() {
  const { sessionToken } = useAdminSession()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkedAt, setCheckedAt] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    callAdmin('adminGetSystemHealth', { sessionToken })
      .then((d) => {
        setData(d)
        setCheckedAt(Date.now())
      })
      .catch((err) => setError(err?.message || 'Could not check system health.'))
      .finally(() => setLoading(false))
  }, [sessionToken])
  useEffect(load, [load])

  const header = (
    <PageHeader
      title="System Health"
      description={checkedAt ? `Cloud Functions, last 24 hours · checked ${fmtRelative(checkedAt)}` : 'Cloud Functions, last 24 hours'}
      actions={
        <Button onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Checking' : 'Re-check'}
        </Button>
      }
    />
  )

  const scope = (
    <Card title="What this page covers" className="mt-6">
      <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
        <li>Covered: server responses (2xx/4xx/5xx), latency, and error-level logs for every deployed Cloud Function, from Cloud Logging.</li>
        <li>Not covered: app crashes on phones or browsers, Firestore/Storage quota and billing, push-notification delivery, or external uptime checks. These aren't collected anywhere today.</li>
        <li>4xx responses include expected rejections (for example a wrong admin password or a signed-out call), so they're not errors by themselves.</li>
      </ul>
    </Card>
  )

  if (loading && !data) {
    return (
      <div>
        {header}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[106px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 rounded-2xl" />
      </div>
    )
  }
  if (error && !data) {
    return (
      <div>
        {header}
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      </div>
    )
  }
  if (data && data.available === false) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={CircleHelp}
            title="Health data unavailable — no verdict"
            description={
              <>
                {data.reason} Until the logs can be read, this panel cannot say whether the backend is healthy or not.
              </>
            }
          />
        </Card>
        {scope}
      </div>
    )
  }

  const t = data.totals
  const fns = data.functions || []
  const failing = fns.filter((f) => f.serverErrors > 0 || f.errorLogs > 0)
  return (
    <div>
      {header}
      {data.sampled?.requestSampleCapped && (
        <div className="mb-4 rounded-xl border border-gray-100 bg-amber-50 px-4 py-3 text-[13px] text-gray-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          Traffic exceeded the 1,000 most recent request records read per check, so request counts and rates cover only the newest part of the 24h window.
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Requests (24h)" value={t.requests} icon={Activity} hint={data.sampled?.requestSampleCapped ? 'Most recent 1,000 only' : undefined} />
        <StatTile label="Server errors (5xx)" value={t.serverErrors} icon={ServerCrash} tone={t.serverErrors ? 'rose' : 'gray'} hint={`${pct(t.serverErrors, t.requests)} of requests`} />
        <StatTile label="Client rejections (4xx)" value={t.clientErrors} tone="gray" hint={`${pct(t.clientErrors, t.requests)} of requests`} />
        <StatTile label="Error log entries" value={t.errorLogs} icon={AlertTriangle} tone={t.errorLogs ? 'amber' : 'gray'} hint={data.sampled?.errorEntries >= 200 ? 'Newest 200 read' : undefined} />
      </div>

      <Card title="Functions" subtitle={failing.length ? `${failing.length} function(s) logged errors or returned 5xx in the window.` : 'No 5xx responses or error logs in the window for any function that ran.'} className="mt-6" padded={false}>
        {fns.length === 0 ? (
          <EmptyState title="No function activity recorded" description="No request or error records were found for the last 24 hours. That means no traffic was logged — not that everything is fine." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[640px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="font-semibold px-5 py-2.5">Function</th>
                  <th className="font-semibold px-3 py-2.5 text-right">Requests</th>
                  <th className="font-semibold px-3 py-2.5 text-right">5xx</th>
                  <th className="font-semibold px-3 py-2.5 text-right">4xx</th>
                  <th className="font-semibold px-3 py-2.5 text-right">p50</th>
                  <th className="font-semibold px-3 py-2.5 text-right">p95</th>
                  <th className="font-semibold px-5 py-2.5">Latest error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fns.map((f) => (
                  <tr key={f.name} className="align-top">
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-gray-900">{f.name}</span>
                      {(f.serverErrors > 0 || f.errorLogs > 0) && (
                        <span className="ml-2">
                          <Badge tone="rose">{f.errorLogs} error log{f.errorLogs === 1 ? '' : 's'}</Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmtNumber(f.requests)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${f.serverErrors ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{fmtNumber(f.serverErrors)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{fmtNumber(f.clientErrors)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{ms(f.p50Ms)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{ms(f.p95Ms)}</td>
                    <td className="px-5 py-2.5 max-w-[320px]">
                      {f.lastError ? (
                        <>
                          <p className="text-xs text-gray-700 break-words">{f.lastError.message || '(no message)'}</p>
                          <p className="text-[11px] text-gray-400">{fmtRelative(f.lastError.atMs)}</p>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {scope}
    </div>
  )
}
