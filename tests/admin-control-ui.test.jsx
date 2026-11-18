// Admin Control Center UI — real components, callables mocked (no network,
// no Firebase). Proves the UI never mutates without an explicit confirm,
// renders unmeasured metrics as "Unavailable" (never 0), never claims
// "healthy" from missing data, and wires every workspace to the right
// read-only endpoint.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const h = vi.hoisted(() => ({ calls: [], responses: {} }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: { uid: 'me' } }, db: {}, storage: {}, default: {} }))
vi.mock(`${SRC}/admin/services/adminCallable.js`, () => ({
  SESSION_ENDED_EVENT: 'campinity-admin:session-ended',
  callAdmin: async (name, data) => {
    h.calls.push([name, data])
    const r = h.responses[name]
    if (r instanceof Error) throw r
    return typeof r === 'function' ? r(data) : r
  }
}))
vi.mock(`${SRC}/admin/services/adminAuthService.js`, () => ({
  adminLogout: async () => {},
  adminLogin: async () => ({}),
  checkAdminPasswordExists: async () => true,
  setAdminPassword: async () => {},
  getAdminCapabilities: async () => ({ apiVersion: 2, deviceAuth: true, verificationListReadOnly: true })
}))
vi.mock(`${SRC}/theme/useTheme.js`, () => ({ useTheme: () => ({ mode: 'light', resolvedIsDark: false, setMode: () => {} }) }))
vi.mock(`${SRC}/firebase/announcementService.js`, () => ({ listRecentAnnouncementsForAdmin: async () => [] }))
// Skip the password screen: the test session is "unlocked" immediately.
vi.mock(`${SRC}/admin/components/AdminLockScreen.jsx`, async () => {
  const { useEffect } = await import('react')
  const { useAdminSession } = await import(`${SRC}/admin/hooks/useAdminSession.jsx`)
  return {
    default: function FakeLock() {
      const { loginWithSession } = useAdminSession()
      useEffect(() => loginWithSession({ sessionToken: 'session-token', expiresAtMs: Date.now() + 3600_000, deviceId: 'd'.repeat(32) }), [loginWithSession])
      return null
    }
  }
})

const { MemoryRouter } = await import('react-router-dom')
const { default: AdminPage } = await import(`${SRC}/pages/AdminPage.jsx`)

const DAY = 86400000
const trend = (fill) => Array.from({ length: 30 }, (_, i) => ({ dayStartMs: Date.UTC(2026, 9, 19) + i * DAY, count: fill(i) }))
const DASHBOARD = {
  generatedAtMs: Date.now() - 30000,
  overview: {
    totalUsers: 1234, newUsers24h: 5, newUsers7d: 40, newUsers30d: 160, active24h: 300, active7d: 700, active30d: 1000,
    totalPosts: 5678, totalCommunities: 42, totalClubs: 7, totalProducts: 90, activeLostFound: 3,
    totalMessages: null, // e.g. aggregation failed
    pendingReports: 12, pendingVerifications: 2, pendingAchievements: null, pendingCollegeRequests: 0, suspendedUsers: 1
  },
  notes: { activity: 'Active users = last app heartbeat within the window.', trendsTimezone: 'Daily buckets are UTC days.' },
  trends: { users: trend((i) => i % 4), posts: trend(() => 2), communities: trend(() => 0), products: trend((i) => (i === 3 ? null : 1)) },
  oldestPending: { reports: { ageMs: 3 * DAY, atLeast: false }, verifications: { ageMs: 0, atLeast: false } },
  feed: [
    { type: 'user_registered', id: 'u1', atMs: Date.now() - 60000, title: 'Asha', subtitle: '@asha', userId: 'u1' },
    { type: 'report_submitted', id: 'r1', atMs: Date.now() - 120000, title: 'Report: spam', subtitle: 'post · pending', userId: null }
  ],
  alerts: [{ level: 'warning', key: 'reports-backlog', title: '12 reports waiting', detail: 'The report backlog is growing.', section: 'reports' }]
}
const USER = { uid: 'u1', displayName: 'Asha New', username: 'asha', avatar: '', avatarMode: 'photo', collegeId: 'c1', collegeName: 'Test College', verifiedCampus: false, moderationStatus: 'active', profileCompleted: true, createdAtMs: Date.now() - DAY, lastActiveAtMs: Date.now() - 60000, activityHidden: false }
const DETAIL = {
  user: { ...USER, bio: 'hi', verificationMethod: null, followersCount: 3 },
  stats: { posts: 2, listings: 1, communitiesOwned: 0, reportsFiled: 0, reportsAgainst: 1 },
  reportsAgainst: [{ id: 'r1', reason: 'spam', details: '', targetType: 'post', targetId: 'p1', status: 'pending', createdAtMs: Date.now() - DAY }],
  moderationHistory: [],
  verificationRequests: [],
  recentPosts: []
}
const MUTATING = ['adminSetUserModerationStatus', 'adminSetUserVerification', 'adminResolveReport', 'adminModerateContent', 'adminReviewVerificationRequest', 'adminDeleteAnnouncement']
const mutations = () => h.calls.filter(([n]) => MUTATING.includes(n))

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  )
}
const sidebar = () => within(screen.getAllByRole('navigation', { name: 'Admin sections' })[0])

beforeEach(() => {
  localStorage.clear()
  h.calls = []
  h.responses = {
    adminGetDashboard: DASHBOARD,
    adminSearchUsers: { mode: 'browse', users: [USER], nextCursor: null },
    adminGetUserDetail: DETAIL,
    adminSetUserModerationStatus: { ok: true },
    adminListReports: {
      reports: [{ id: 'r1', reason: 'spam', details: 'looks like spam', targetType: 'post', targetId: 'p1', status: 'pending', reporterUid: 'x', reporter: { displayName: 'Reporter Ravi', username: 'ravi' }, targetOwner: { displayName: 'Owner Olga', username: 'olga' }, createdAt: { _seconds: Math.floor(Date.now() / 1000) - 600 } }],
      nextCursor: null
    },
    adminGetReportContext: {
      report: { id: 'r1', reason: 'spam', details: 'looks like spam', status: 'pending', targetType: 'post', targetId: 'p1', createdAtMs: Date.now() - 600000, reviewedAtMs: null },
      target: { type: 'post', id: 'p1', exists: true, text: 'Buy followers now', imageUrl: null, authorUid: 'o1', visibility: 'public', createdAtMs: Date.now() - DAY },
      reporter: { uid: 'x', displayName: 'Reporter Ravi', username: 'ravi' },
      owner: { ...USER, uid: 'o1', displayName: 'Owner Olga', username: 'olga' },
      sameTargetReports: [{ id: 'r2', reason: 'scam', status: 'pending', targetType: 'post', createdAtMs: Date.now() - 1000 }],
      sameOwnerReports: [],
      history: []
    },
    adminGetSystemHealth: { available: false, reason: 'The functions service account is not allowed to read logs (needs roles/logging.viewer).' },
    adminListAuditLog: { entries: [], nextCursor: null }
  }
})
afterEach(cleanup)

describe('Overview', () => {
  test('real numbers, "Unavailable" for unmeasured metrics, alerts, one shared dashboard read, no mutations', async () => {
    renderAdmin()
    expect(await screen.findByText('1,234')).toBeTruthy()
    expect(screen.getByText('5,678')).toBeTruthy()
    // totalMessages null -> tile says Unavailable, never 0
    const messagesTile = screen.getByText('Chat messages').closest('div').parentElement
    expect(within(messagesTile).getByText('Unavailable')).toBeTruthy()
    // pendingAchievements null in the queue list
    const achievements = screen.getAllByText('Achievements').find((el) => el.className.includes('block')).closest('button')
    expect(within(achievements).getByText('Unavailable')).toBeTruthy()
    expect(screen.getAllByText('12 reports waiting').length).toBeGreaterThan(0)
    expect(screen.getByText(/Oldest waiting\s*3 days/)).toBeTruthy()
    // four small-multiple trend charts, each with a table toggle
    expect(screen.getAllByRole('img', { name: /daily counts for the last 30 days/ })).toHaveLength(4)
    expect(h.calls.filter(([n]) => n === 'adminGetDashboard')).toHaveLength(1)
    expect(h.calls[0][1]).toEqual({ sessionToken: 'session-token' })
    expect(mutations()).toEqual([])
  })

  test('chart table view shows exact values and "n/a" for an unmeasured day', async () => {
    renderAdmin()
    await screen.findByText('1,234')
    const listings = screen.getByText('New listings').closest('div').parentElement.parentElement
    fireEvent.click(within(listings).getByRole('button', { name: 'Show as table' }))
    expect(within(listings).getByRole('table')).toBeTruthy()
    expect(within(listings).getByText('n/a')).toBeTruthy()
  })

  test('dashboard failure: error + retry, and the alerts menu says nothing is known (no "healthy")', async () => {
    h.responses.adminGetDashboard = new Error('permission denied')
    renderAdmin()
    expect(await screen.findByText("Couldn't load this")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Platform alerts/ }))
    expect(screen.getByText("Alerts couldn't be checked")).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/healthy|all clear/i)
  })

  test('no alerts -> "no thresholds crossed", explicitly not a health verdict', async () => {
    h.responses.adminGetDashboard = { ...DASHBOARD, alerts: [] }
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.click(screen.getByRole('button', { name: /Platform alerts/ }))
    expect(screen.getByText('No alert thresholds crossed')).toBeTruthy()
    expect(screen.getByText(/don't cover\s+function errors/)).toBeTruthy()
  })
})

describe('Users', () => {
  test('search -> detail -> suspend requires confirmation; cancel sends nothing; confirm sends exactly one call', async () => {
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.click(sidebar().getByRole('button', { name: /^Users/ }))
    fireEvent.click(await screen.findByText('Asha New'))
    expect(await screen.findByText('Reports against this user')).toBeTruthy()
    expect(h.calls.find(([n]) => n === 'adminGetUserDetail')[1]).toEqual({ sessionToken: 'session-token', uid: 'u1' })
    expect(document.body.textContent).not.toMatch(/@example|email/i)

    fireEvent.click(screen.getByRole('button', { name: /Suspend/ }))
    expect(screen.getByText('Suspend Asha New?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mutations()).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /Suspend/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Suspend user' }))
    await waitFor(() => expect(mutations()).toHaveLength(1))
    expect(mutations()[0]).toEqual(['adminSetUserModerationStatus', { sessionToken: 'session-token', uid: 'u1', status: 'suspended' }])
  })

  test('"Restrict" and "Ban" are not offered (not enforced / no backend)', async () => {
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.click(sidebar().getByRole('button', { name: /^Users/ }))
    fireEvent.click(await screen.findByText('Asha New'))
    await screen.findByText('Reports against this user')
    expect(screen.queryByRole('button', { name: /restrict/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /\bban\b/i })).toBeNull()
  })

  test('top-bar search opens Users with the query', async () => {
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.change(screen.getByRole('textbox', { name: 'Search users', exact: true }), { target: { value: '@asha' } })
    fireEvent.submit(screen.getAllByRole('search')[0])
    await waitFor(() => expect(h.calls.some(([n, d]) => n === 'adminSearchUsers' && d.query === '@asha')).toBe(true))
  })
})

describe('Reports', () => {
  test('names instead of raw UIDs; investigate loads context; nothing resolves without confirmation', async () => {
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.click(sidebar().getByRole('button', { name: /^Reports/ }))
    expect(await screen.findByText(/By Reporter Ravi · against Owner Olga/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Investigate' })[0])
    expect(await screen.findByText('Buy followers now')).toBeTruthy()
    expect(screen.getByText(/Other reports on this content/)).toBeTruthy()
    expect(mutations()).toEqual([])
    const drawer = screen.getByRole('dialog', { name: 'Investigate report' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Dismiss' }))
    expect(screen.getByText('Dismiss this report?')).toBeTruthy()
    expect(mutations()).toEqual([])
  })
})

describe('System Health', () => {
  test('logs unreadable -> explicit "no verdict" with the reason', async () => {
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.click(sidebar().getByRole('button', { name: /System Health/ }))
    expect(await screen.findByText('Health data unavailable — no verdict')).toBeTruthy()
    expect(screen.getByText(/roles\/logging\.viewer/)).toBeTruthy()
  })

  test('available -> per-function table from the real response', async () => {
    h.responses.adminGetSystemHealth = {
      available: true,
      windowHours: 24,
      sampled: { errorEntries: 1, requestEntries: 3, requestSampleCapped: false },
      totals: { requests: 3, serverErrors: 1, clientErrors: 1, errorLogs: 1 },
      functions: [{ name: 'adminlogin', requests: 2, clientErrors: 0, serverErrors: 1, errorLogs: 1, p50Ms: 120, p95Ms: 1500, lastError: { atMs: Date.now(), message: 'boom' } }]
    }
    renderAdmin()
    await screen.findByText('1,234')
    fireEvent.click(sidebar().getByRole('button', { name: /System Health/ }))
    expect(await screen.findByText('adminlogin')).toBeTruthy()
    expect(screen.getByText('1.5 s')).toBeTruthy()
    expect(screen.getByText('boom')).toBeTruthy()
  })
})
