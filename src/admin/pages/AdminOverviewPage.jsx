import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Flag,
  Gavel,
  GraduationCap,
  History,
  Image,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users
} from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import { ACTION_LABELS, formatAuditWhen } from '../utils/auditLogFormat.js'

/**
 * Every card below is driven by adminGetOverviewCounts (extended with
 * newUsersToday/marketplaceListings on the SAME function — see that
 * function's own comment in functions/index.js) plus adminListAuditLog
 * for Recent Activity — both callable functions this admin panel
 * already had before this pass. No new backend surface, no second
 * counting/audit system, no fabricated numbers: a key with no matching
 * field in the response renders "Unavailable," never a fake 0.
 *
 * Clicking a card calls `onNavigateSection` — the SAME setActiveSection
 * callback AdminSidebar.jsx already uses (AdminPage.jsx owns admin
 * "sections" as in-memory state, not real routes, since the whole
 * dashboard only exists behind an in-memory unlock anyway — see
 * AdminSidebar.jsx's own comment). This reuses that exact mechanism
 * rather than introducing React Router for a part of the tree that was
 * deliberately built without it.
 */
const ATTENTION_CARDS = [
  { key: 'reports', label: 'Pending Reports', section: 'reports', icon: Flag, tone: 'red' },
  { key: 'verification', label: 'Photo Verifications', section: 'photo-verification', icon: Image, tone: 'amber' },
  { key: 'college', label: 'College Requests', section: 'college-requests', icon: GraduationCap, tone: 'blue' },
  { key: 'lostFound', label: 'Active Lost & Found', section: 'lost-found', icon: PackageSearch, tone: 'violet' }
]

// `derived: true` cards are computed client-side from fields already in
// the response (no extra backend call); `section: null` cards have no
// destination that would show something more specific than the search-
// driven User Verification page already covers via the two cards above
// it, so per this task's own "keep non-clickable rather than force a
// destination" instruction, they stay informational only.
const PLATFORM_CARDS = [
  { key: 'totalUsers', label: 'Total Users', section: 'user-verification', icon: Users },
  { key: 'verifiedUsers', label: 'Verified Users', section: 'user-verification', icon: ShieldCheck },
  { key: 'unverifiedUsers', label: 'Unverified Users', section: null, derived: true },
  { key: 'newUsersToday', label: 'New Users Today', section: null },
  { key: 'marketplaceListings', label: 'Marketplace Listings', section: 'marketplace', icon: ShoppingBag }
]

const QUICK_ACTIONS = [
  { label: 'Review Reports', section: 'reports', icon: Flag },
  { label: 'Verify Photos', section: 'photo-verification', icon: Image },
  { label: 'College Requests', section: 'college-requests', icon: GraduationCap },
  { label: 'Review Users', section: 'user-verification', icon: ShieldCheck },
  { label: 'Moderation', section: 'moderation', icon: Gavel },
  { label: 'Marketplace', section: 'marketplace', icon: ShoppingBag },
  { label: 'Lost & Found', section: 'lost-found', icon: PackageSearch },
  { label: 'Send Notification', section: 'notifications', icon: Bell }
]

const TONE_CLASSES = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600'
}

function CardValue({ loading, value }) {
  if (loading) return <span className="inline-block w-10 h-7 rounded-md bg-gray-100 animate-pulse" />
  if (value === undefined || value === null) return <span className="text-sm font-medium text-gray-300">Unavailable</span>
  return <span>{value}</span>
}

export default function AdminOverviewPage({ onNavigateSection }) {
  const { sessionToken } = useAdminSession()
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState('')

  const loadCounts = () => {
    setLoading(true)
    setError('')
    callAdmin('adminGetOverviewCounts', { sessionToken })
      .then((data) => setCounts(data || {}))
      .catch((err) => setError(err?.message || 'Could not load overview stats.'))
      .finally(() => setLoading(false))
  }

  const loadActivity = () => {
    setActivityLoading(true)
    setActivityError('')
    // Small pageSize deliberately — this is a preview, not the log
    // itself (AdminAuditLogPage.jsx), so it stays a cheap read.
    callAdmin('adminListAuditLog', { sessionToken, pageSize: 6 })
      .then((data) => setActivity(data?.entries || []))
      .catch((err) => setActivityError(err?.message || 'Could not load recent activity.'))
      .finally(() => setActivityLoading(false))
  }

  useEffect(() => {
    loadCounts()
    loadActivity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken])

  const goTo = (section) => {
    if (section && onNavigateSection) onNavigateSection(section)
  }

  const unverifiedUsers =
    counts && typeof counts.totalUsers === 'number' && typeof counts.verifiedUsers === 'number'
      ? counts.totalUsers - counts.verifiedUsers
      : undefined

  const valueFor = (card) => (card.derived ? unverifiedUsers : counts ? counts[card.key] : undefined)

  const totalPending = ATTENTION_CARDS.reduce((sum, card) => {
    const v = counts ? counts[card.key] : undefined
    return typeof v === 'number' ? sum + v : sum
  }, 0)
  const allClear = !loading && !error && counts && totalPending === 0

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Overview</h1>
          <p className="mt-1 text-sm text-gray-400">
            {allClear ? "Here's your platform — everything's clear right now." : "Here's what needs your attention."}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3 flex items-center justify-between">
          {error}
          <button type="button" onClick={loadCounts} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {/* NEEDS YOUR ATTENTION — the actionable queue, most important first. */}
      <section className="mt-6">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Needs your attention</h2>

        {allClear ? (
          <div className="mt-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-700">All clear — no pending reports, verifications or requests.</p>
          </div>
        ) : (
          <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ATTENTION_CARDS.map((card) => {
              const value = counts ? counts[card.key] : undefined
              const urgent = typeof value === 'number' && value > 0
              const Icon = card.icon
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => goTo(card.section)}
                  className="group text-left rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONE_CLASSES[card.tone]}`}>
                      <Icon className="w-4 h-4" strokeWidth={1.8} />
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-gray-900">
                    <CardValue loading={loading} value={value} />
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{card.label}</p>
                  {urgent && <span className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* PLATFORM OVERVIEW — general stats, lower visual weight than the attention row. */}
      <section className="mt-7">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Platform overview</h2>
        <div className="mt-2.5 grid grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORM_CARDS.map((card) => {
            const value = valueFor(card)
            const clickable = Boolean(card.section)
            const Wrapper = clickable ? 'button' : 'div'
            return (
              <Wrapper
                key={card.key}
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => goTo(card.section) : undefined}
                className={`text-left rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 ${
                  clickable
                    ? 'group cursor-pointer hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  {card.icon ? (
                    <span className="w-7 h-7 rounded-md bg-gray-50 text-gray-500 flex items-center justify-center">
                      <card.icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </span>
                  ) : (
                    <span />
                  )}
                  {clickable && (
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" />
                  )}
                </div>
                <p className="mt-2.5 text-2xl font-bold text-gray-900">
                  <CardValue loading={loading} value={value} />
                </p>
                <p className="mt-0.5 text-xs text-gray-400">{card.label}</p>
              </Wrapper>
            )
          })}
        </div>
      </section>

      {/* QUICK ACTIONS — one tap to every section this dashboard can meaningfully jump into. */}
      <section className="mt-7">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Quick actions</h2>
        <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.section}
              type="button"
              onClick={() => goTo(action.section)}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-left text-[13px] font-medium text-gray-700 transition-all duration-200 hover:border-gray-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <action.icon className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.8} />
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* RECENT ACTIVITY — a preview of the same audit trail AdminAuditLogPage.jsx reads in full. */}
      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Recent activity</h2>
          <button
            type="button"
            onClick={() => goTo('audit-log')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View full log
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="mt-2.5 rounded-xl border border-gray-100 bg-white overflow-hidden">
          {activityLoading ? (
            <div className="py-10 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            </div>
          ) : activityError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">{activityError}</p>
              <button type="button" onClick={loadActivity} className="mt-2 text-xs font-semibold text-blue-600">
                Retry
              </button>
            </div>
          ) : activity.length === 0 ? (
            <div className="py-8 text-center">
              <History className="w-4 h-4 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm text-gray-400">No admin actions recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activity.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 truncate">{ACTION_LABELS[entry.action] || entry.action}</p>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">
                      {entry.targetType && entry.targetType}
                      {entry.targetUid && ` · user ${entry.targetUid}`}
                    </p>
                  </div>
                  <p className="flex-shrink-0 text-[11px] text-gray-400">{formatAuditWhen(entry.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
