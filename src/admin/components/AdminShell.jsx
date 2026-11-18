import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Award,
  Bell,
  BellRing,
  Flag,
  Gavel,
  GraduationCap,
  History,
  KeyRound,
  Image,
  LayoutGrid,
  Lock,
  Menu,
  Megaphone,
  PackageSearch,
  Search,
  ShoppingBag,
  Users,
  UsersRound,
  X
} from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { useAdminWorkspace } from '../hooks/useAdminWorkspace.jsx'
import { adminLogout } from '../services/adminAuthService.js'
import { useTheme } from '../../theme/useTheme.js'
import { useBackToClose } from '../../navigation/overlayBackStack.js'
import { fmtRelative } from './ui.jsx'

/**
 * Navigation. `countKey` reads the pending count for that queue from the
 * shared dashboard snapshot (adminGetDashboard.overview) — only shown when
 * it was actually measured.
 */
export const NAV_GROUPS = [
  { label: null, items: [{ key: 'overview', label: 'Overview', icon: LayoutGrid }] },
  { label: 'People', items: [{ key: 'users', label: 'Users', icon: Users }] },
  {
    label: 'Trust & Safety',
    items: [
      { key: 'reports', label: 'Reports', icon: Flag, countKey: 'pendingReports' },
      { key: 'moderation', label: 'Content Moderation', icon: Gavel },
      { key: 'photo-verification', label: 'Verification', icon: Image, countKey: 'pendingVerifications' }
    ]
  },
  {
    label: 'Campus',
    items: [
      { key: 'communities', label: 'Communities', icon: UsersRound },
      { key: 'college-requests', label: 'Colleges', icon: GraduationCap, countKey: 'pendingCollegeRequests' },
      { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
      { key: 'lost-found', label: 'Lost & Found', icon: PackageSearch },
      { key: 'achievement-verification', label: 'Achievements', icon: Award, countKey: 'pendingAchievements' }
    ]
  },
  {
    label: 'Communication',
    items: [
      { key: 'notices', label: 'Notice Board', icon: Megaphone },
      { key: 'notifications', label: 'Notifications & Announcements', icon: Bell }
    ]
  },
  {
    label: 'System',
    items: [
      { key: 'audit-log', label: 'Audit Logs', icon: History },
      { key: 'system-health', label: 'System Health', icon: Activity },
      { key: 'devices', label: 'Devices', icon: KeyRound }
    ]
  }
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)
export const sectionLabel = (key) => (key === 'user-verification' ? 'Users' : ALL_ITEMS.find((i) => i.key === key)?.label || 'Overview')

function NavList({ onPick }) {
  const { section, navigate, dashboard } = useAdminWorkspace()
  const counts = dashboard?.overview || {}
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-4">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label || `g${gi}`}>
          {group.label && <p className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">{group.label}</p>}
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ key, label, icon: Icon, countKey }) => {
              const active = section === key || (key === 'users' && section === 'user-verification')
              const count = countKey ? counts[countKey] : null
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    navigate(key)
                    onPick?.()
                  }}
                  className={`flex items-center gap-2.5 rounded-xl pl-3 pr-2.5 py-2 text-[13.5px] font-medium text-left transition-colors duration-150 ${
                    active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={1.9} />
                  <span className="flex-1 min-w-0 truncate">{label}</span>
                  {typeof count === 'number' && count > 0 && (
                    <span className={`min-w-[22px] text-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-[13px] font-bold">C</span>
      <div className="leading-tight">
        <p className="text-[14.5px] font-bold tracking-tight text-gray-900">Campinity</p>
        <p className="text-[11px] font-medium text-gray-500">Admin Control Center</p>
      </div>
    </div>
  )
}

function AlertsMenu() {
  const { dashboard, dashboardLoading, dashboardError, navigate, reloadDashboard } = useAdminWorkspace()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useBackToClose(open, () => setOpen(false))
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const alerts = dashboard?.alerts || []
  const critical = alerts.some((a) => a.level === 'critical')
  const attention = alerts.filter((a) => a.level !== 'info').length
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Platform alerts${alerts.length ? `, ${alerts.length}` : ''}`}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100"
      >
        {alerts.length ? <BellRing className="w-[18px] h-[18px]" /> : <Bell className="w-[18px] h-[18px]" />}
        {(attention > 0 || dashboardError) && (
          <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${critical || dashboardError ? 'bg-red-600' : 'bg-amber-500'}`} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] max-w-[calc(100vw-24px)] rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Platform alerts</p>
            {dashboard?.generatedAtMs && <p className="text-[11px] text-gray-500">Checked {fmtRelative(dashboard.generatedAtMs)}</p>}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {dashboardLoading && !dashboard ? (
              <p className="px-4 py-6 text-sm text-gray-500">Checking…</p>
            ) : dashboardError ? (
              <div className="px-4 py-5">
                <p className="text-sm font-semibold text-gray-900">Alerts couldn't be checked</p>
                <p className="mt-1 text-xs text-gray-500">{dashboardError} Nothing is known about platform state until this loads.</p>
                <button type="button" onClick={reloadDashboard} className="mt-3 text-xs font-semibold text-blue-600">Retry</button>
              </div>
            ) : alerts.length === 0 ? (
              <div className="px-4 py-5">
                <p className="text-sm font-semibold text-gray-900">No alert thresholds crossed</p>
                <p className="mt-1 text-xs text-gray-500">
                  Checks cover queue sizes and ages (reports, verification, achievements, colleges) and sign-up spikes. They don't cover
                  function errors — see System Health.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {alerts.map((a) => (
                  <li key={a.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        if (a.section) navigate(a.section)
                      }}
                      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-100"
                    >
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.level === 'critical' ? 'text-red-600' : a.level === 'warning' ? 'text-amber-600' : 'text-blue-600'}`} />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-gray-900">{a.title}</span>
                        <span className="block mt-0.5 text-xs text-gray-500">{a.detail}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ThemeSwitch() {
  const { resolvedIsDark, setMode } = useTheme()
  return (
    <button
      type="button"
      onClick={() => setMode(resolvedIsDark ? 'light' : 'dark')}
      aria-label={resolvedIsDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100"
    >
      {resolvedIsDark ? (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  )
}

function GlobalSearch() {
  const { navigate } = useAdminWorkspace()
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const term = q.trim()
        if (!term) return
        navigate('users', { query: term })
        setQ('')
      }}
      className="relative flex-1 max-w-[420px]"
    >
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users by name, @username or UID"
        aria-label="Search users"
        className="w-full h-9 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500"
      />
    </form>
  )
}

export default function AdminShell({ children }) {
  const { sessionToken, logout } = useAdminSession()
  const { section } = useAdminWorkspace()
  const [mobileNav, setMobileNav] = useState(false)
  useBackToClose(mobileNav, () => setMobileNav(false))

  const lock = async () => {
    await adminLogout(sessionToken).catch(() => {})
    logout()
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[248px] flex-shrink-0 h-screen sticky top-0 border-r border-gray-100 bg-white">
        <div className="h-16 flex items-center border-b border-gray-100 px-2">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </div>
        <div className="p-3 border-t border-gray-100">
          <button type="button" onClick={lock} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-gray-600 hover:bg-gray-100">
            <Lock className="w-[17px] h-[17px]" /> Lock panel
          </button>
        </div>
      </aside>

      {/* Mobile / tablet navigation drawer */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-[800] flex" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="relative w-[280px] max-w-[85vw] h-full bg-white flex flex-col shadow-2xl">
            <div className="h-16 flex items-center justify-between border-b border-gray-100 pl-2 pr-3">
              <Brand />
              <button type="button" onClick={() => setMobileNav(false)} aria-label="Close menu" className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList onPick={() => setMobileNav(false)} />
            </div>
            <div className="p-3 border-t border-gray-100">
              <button type="button" onClick={lock} className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium text-gray-600 hover:bg-gray-100">
                <Lock className="w-[17px] h-[17px]" /> Lock panel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 h-16 flex items-center gap-3 px-4 sm:px-6 lg:px-8 border-b border-gray-100 bg-white">
          <button type="button" onClick={() => setMobileNav(true)} aria-label="Open menu" className="lg:hidden w-9 h-9 -ml-1 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>
          <p className="hidden sm:block text-[13px] text-gray-500 whitespace-nowrap">
            Admin <span className="mx-1 text-gray-300">/</span>
            <span className="font-semibold text-gray-900">{sectionLabel(section)}</span>
          </p>
          <div className="flex-1 flex justify-end sm:justify-center min-w-0">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1">
            <AlertsMenu />
            <ThemeSwitch />
            <span className="hidden md:inline-flex items-center gap-2 ml-1 pl-3 border-l border-gray-100 text-[12.5px] font-medium text-gray-600" title="Unlocked with the admin password for this browser tab only">
              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" /> Admin session
            </span>
          </div>
        </header>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
