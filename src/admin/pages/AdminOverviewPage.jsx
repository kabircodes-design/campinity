import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Ban,
  BadgeCheck,
  Flag,
  GraduationCap,
  Image,
  MessageSquare,
  Newspaper,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  UserPlus,
  Users,
  UsersRound
} from 'lucide-react'
import { useAdminWorkspace } from '../hooks/useAdminWorkspace.jsx'
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatTile, fmtDuration, fmtNumber, fmtRelative } from '../components/ui.jsx'
import DailyColumnChart from '../components/DailyColumnChart.jsx'
import { ACTION_LABELS } from '../utils/auditLogFormat.js'

/**
 * Command center. Everything comes from ONE read-only callable,
 * adminGetDashboard (functions/adminControl.js), shared with the top-bar
 * alerts through useAdminWorkspace. Any metric the server couldn't
 * measure arrives as null and renders "Unavailable" — never a fake 0 —
 * and an empty alert list is described as "no thresholds crossed",
 * never as "the platform is healthy".
 */

const FEED_META = {
  user_registered: { label: 'New user', icon: UserPlus, tone: 'blue' },
  post_created: { label: 'Post', icon: Newspaper, tone: 'gray' },
  community_created: { label: 'Community', icon: UsersRound, tone: 'purple' },
  club_created: { label: 'Club', icon: UsersRound, tone: 'purple' },
  listing_created: { label: 'Listing', icon: ShoppingBag, tone: 'emerald' },
  report_submitted: { label: 'Report', icon: Flag, tone: 'rose' },
  moderation_action: { label: 'Admin action', icon: Ban, tone: 'amber' },
  verification_submitted: { label: 'Verification', icon: BadgeCheck, tone: 'blue' }
}
const FEED_SECTION = {
  report_submitted: 'reports',
  moderation_action: 'audit-log',
  verification_submitted: 'photo-verification',
  listing_created: 'marketplace',
  community_created: 'communities',
  club_created: 'communities'
}
const FEED_FILTERS = [
  ['all', 'All'],
  ['people', 'People'],
  ['content', 'Content'],
  ['safety', 'Trust & Safety']
]
const FEED_GROUP = {
  user_registered: 'people',
  verification_submitted: 'people',
  post_created: 'content',
  community_created: 'content',
  club_created: 'content',
  listing_created: 'content',
  report_submitted: 'safety',
  moderation_action: 'safety'
}

function QueueRow({ icon: Icon, label, value, onClick, ageMs, ageAtLeast }) {
  const n = fmtNumber(value)
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-100 transition-colors duration-150">
      <span className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-medium text-gray-900">{label}</span>
        {typeof ageMs === 'number' && ageMs > 0 && (
          <span className="block text-xs text-gray-500">
            Oldest waiting {ageAtLeast ? 'at least ' : ''}
            {fmtDuration(ageMs)}
          </span>
        )}
      </span>
      {n === null ? (
        <span className="text-xs font-semibold text-gray-400" title="Could not be counted">Unavailable</span>
      ) : (
        <span className={`text-[17px] font-bold tabular-nums ${value > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{n}</span>
      )}
      <ArrowRight className="w-4 h-4 text-gray-300" />
    </button>
  )
}

export default function AdminOverviewPage() {
  const { dashboard, dashboardLoading, dashboardError, reloadDashboard, navigate } = useAdminWorkspace()
  const [feedFilter, setFeedFilter] = useState('all')
  const [, tick] = useState(0)
  // Keep "x minutes ago" honest without refetching anything.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60000)
    return () => window.clearInterval(t)
  }, [])

  if (dashboardError && !dashboard) {
    return (
      <div>
        <PageHeader title="Overview" description="Platform state at a glance." />
        <Card>
          <ErrorState message={dashboardError} onRetry={reloadDashboard} />
        </Card>
      </div>
    )
  }

  const o = dashboard?.overview || {}
  const loading = dashboardLoading && !dashboard
  const alerts = dashboard?.alerts || []
  const feed = (dashboard?.feed || []).filter((e) => feedFilter === 'all' || FEED_GROUP[e.type] === feedFilter)
  const tile = (props) => (loading ? <Skeleton key={props.label} className="h-[106px] rounded-2xl" /> : <StatTile key={props.label} {...props} />)

  return (
    <div>
      <PageHeader
        title="Overview"
        description={
          dashboard?.generatedAtMs ? (
            <>
              Snapshot from {fmtRelative(dashboard.generatedAtMs)}. {dashboard.notes?.trendsTimezone}
            </>
          ) : (
            'Platform state at a glance.'
          )
        }
        actions={
          <Button onClick={reloadDashboard} disabled={dashboardLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${dashboardLoading ? 'animate-spin' : ''}`} />
            {dashboardLoading ? 'Refreshing' : 'Refresh'}
          </Button>
        }
      />

      {dashboardError && dashboard && (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          Refresh failed: {dashboardError} Showing the previous snapshot.
        </div>
      )}

      {/* Alerts */}
      {!loading && alerts.length > 0 && (
        <div className="mb-6 grid gap-2.5 md:grid-cols-2">
          {alerts.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => a.section && navigate(a.section)}
              className={`text-left rounded-2xl border px-4 py-3 flex gap-3 items-start transition-colors duration-150 ${
                a.level === 'critical' ? 'border-red-200 bg-red-50' : a.level === 'warning' ? 'border-gray-100 bg-amber-50' : 'border-gray-100 bg-blue-50'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.level === 'critical' ? 'text-red-600' : a.level === 'warning' ? 'text-amber-600' : 'text-blue-600'}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-gray-900">{a.title}</span>
                  <Badge tone={a.level === 'critical' ? 'rose' : a.level === 'warning' ? 'amber' : 'blue'}>{a.level}</Badge>
                </span>
                <span className="block mt-0.5 text-xs text-gray-600">{a.detail}</span>
              </span>
              <ArrowRight className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Platform KPIs */}
      <section aria-label="Platform totals" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tile({ label: 'Total users', value: o.totalUsers, icon: Users, onClick: () => navigate('users') })}
        {tile({ label: 'Posts', value: o.totalPosts, icon: Newspaper, tone: 'gray' })}
        {tile({ label: 'Communities', value: o.totalCommunities, icon: UsersRound, tone: 'purple', hint: typeof o.totalClubs === 'number' ? `${fmtNumber(o.totalClubs)} official clubs` : undefined, onClick: () => navigate('communities') })}
        {tile({ label: 'Listings', value: o.totalProducts, icon: ShoppingBag, tone: 'emerald', onClick: () => navigate('marketplace') })}
        {tile({ label: 'Active Lost & Found', value: o.activeLostFound, icon: PackageSearch, tone: 'amber', onClick: () => navigate('lost-found') })}
        {tile({ label: 'Chat messages', value: o.totalMessages, icon: MessageSquare, tone: 'gray', hint: 'Count only — no content read' })}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Growth & engagement */}
          <Card title="Registrations & activity" subtitle={dashboard?.notes?.activity}>
            {loading ? (
              <Skeleton className="h-[120px]" />
            ) : (
              <div className="grid gap-px rounded-xl overflow-hidden border border-gray-100 bg-gray-100 sm:grid-cols-2">
                {[
                  ['New registrations', [['24 hours', o.newUsers24h], ['7 days', o.newUsers7d], ['30 days', o.newUsers30d]]],
                  ['Active users', [['24 hours', o.active24h], ['7 days', o.active7d], ['30 days', o.active30d]]]
                ].map(([heading, rows]) => (
                  <div key={heading} className="bg-white p-4">
                    <p className="text-[12.5px] font-medium text-gray-500">{heading}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {rows.map(([k, v]) => (
                        <div key={k}>
                          <p className={`text-[20px] font-bold tabular-nums leading-tight ${v === null || v === undefined ? 'text-gray-400 text-sm' : 'text-gray-900'}`}>
                            {fmtNumber(v) ?? 'Unavailable'}
                          </p>
                          <p className="text-[11.5px] text-gray-500">{k}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Trends: one series per chart (small multiples, shared style) */}
          <section aria-label="30-day trends">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-gray-900">30-day trends</h2>
              <p className="text-xs text-gray-500">New items per day</p>
            </div>
            {loading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[236px] rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <DailyColumnChart title="New users" data={dashboard?.trends?.users || []} unit="sign-ups" />
                <DailyColumnChart title="New posts" data={dashboard?.trends?.posts || []} unit="posts" />
                <DailyColumnChart title="New communities" data={dashboard?.trends?.communities || []} unit="communities" />
                <DailyColumnChart title="New listings" data={dashboard?.trends?.products || []} unit="listings" />
              </div>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Work queues */}
          <Card title="Work queues" subtitle="Pending items waiting for an admin." padded={false}>
            <div className="mt-2 pb-2 divide-y divide-gray-100">
              {loading ? (
                <div className="px-5 py-3 space-y-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : (
                <>
                  <QueueRow icon={Flag} label="Reports" value={o.pendingReports} ageMs={dashboard?.oldestPending?.reports?.ageMs} ageAtLeast={dashboard?.oldestPending?.reports?.atLeast} onClick={() => navigate('reports')} />
                  <QueueRow icon={Image} label="Campus verification" value={o.pendingVerifications} ageMs={dashboard?.oldestPending?.verifications?.ageMs} ageAtLeast={dashboard?.oldestPending?.verifications?.atLeast} onClick={() => navigate('photo-verification')} />
                  <QueueRow icon={Award} label="Achievements" value={o.pendingAchievements} onClick={() => navigate('achievement-verification')} />
                  <QueueRow icon={GraduationCap} label="College requests" value={o.pendingCollegeRequests} onClick={() => navigate('college-requests')} />
                  <QueueRow icon={Ban} label="Suspended users" value={o.suspendedUsers} onClick={() => navigate('users', { moderationStatus: 'suspended' })} />
                </>
              )}
            </div>
          </Card>

          {/* Live activity feed (latest snapshot; refreshes with the dashboard) */}
          <Card
            title="Latest activity"
            subtitle="Newest events across the platform, as of this snapshot."
            padded={false}
            action={
              <button type="button" onClick={() => navigate('audit-log')} className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                Audit logs
              </button>
            }
          >
            <div className="px-5 pt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter activity">
              {FEED_FILTERS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={feedFilter === k}
                  onClick={() => setFeedFilter(k)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${feedFilter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : feed.length === 0 ? (
              <EmptyState title="Nothing here yet" description="No events of this kind in the latest snapshot." />
            ) : (
              <ul className="mt-2 pb-2 max-h-[560px] overflow-y-auto">
                {feed.map((e) => {
                  const meta = FEED_META[e.type] || { label: e.type, icon: Flag, tone: 'gray' }
                  const Icon = meta.icon
                  const goto = e.type === 'user_registered' && e.userId ? () => navigate('users', { openUid: e.userId }) : FEED_SECTION[e.type] ? () => navigate(FEED_SECTION[e.type]) : null
                  const title = e.type === 'moderation_action' ? ACTION_LABELS[e.title] || e.title : e.title
                  const Row = goto ? 'button' : 'div'
                  return (
                    <li key={`${e.type}-${e.id}`}>
                      <Row type={goto ? 'button' : undefined} onClick={goto || undefined} className={`w-full text-left flex gap-3 px-5 py-2.5 ${goto ? 'hover:bg-gray-100' : ''}`}>
                        <span className="w-7 h-7 mt-0.5 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-gray-900 truncate">{title}</span>
                          </span>
                          <span className="block text-xs text-gray-500 truncate">
                            {meta.label}
                            {e.subtitle ? ` · ${e.subtitle}` : ''}
                          </span>
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap mt-0.5">{fmtRelative(e.atMs)}</span>
                      </Row>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
