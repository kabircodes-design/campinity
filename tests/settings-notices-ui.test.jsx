// Settings expansion + Notice Board UI — real components with Firebase mocked.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({
  auth: { currentUser: null },
  calls: [],
  reserve: null,
  reauth: null,
  verifyBefore: null,
  notices: [],
  reads: {},
  noticeError: null,
  callAdmin: {},
  report: null,
  userDoc: null,
  availability: true
}))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: m.auth, db: {}, storage: {}, googleProvider: {}, default: {} }))
vi.mock(`${SRC}/theme/useTheme.js`, () => ({ useTheme: () => ({ mode: 'light', resolvedIsDark: false, setMode: () => {}, theme: { id: 'default' } }) }))
const authState = vi.hoisted(() => ({ value: { user: null, profile: { username: 'asha', verifiedCampus: true, college: 'North Campus', course: 'CSE', year: '2' }, loading: false } }))
vi.mock(`${SRC}/context/AuthContext.jsx`, () => ({ useAuth: () => authState.value }))
vi.mock(`${SRC}/firebase/usernameService.js`, async (orig) => {
  const real = await orig()
  return {
    ...real,
    checkUsernameAvailable: async (name, uid) => {
      m.calls.push(['available?', name, uid])
      return m.availability
    },
    reserveUsername: async (args) => {
      m.calls.push(['reserve', args])
      if (m.reserve instanceof Error) throw m.reserve
      return real.normalizeUsername(args.newUsername)
    }
  }
})
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig()),
  EmailAuthProvider: { credential: (email, pw) => ({ email, pw }) },
  reauthenticateWithCredential: async (_u, cred) => {
    m.calls.push(['reauth', cred.pw])
    if (m.reauth instanceof Error) throw m.reauth
  },
  verifyBeforeUpdateEmail: async (_u, email, settings) => {
    m.calls.push(['verifyBeforeUpdateEmail', email, settings])
    if (typeof m.verifyBefore === 'function') return m.verifyBefore(settings)
    if (m.verifyBefore instanceof Error) throw m.verifyBefore
  },
  signOut: async () => {
    m.calls.push(['signOut'])
    m.auth.currentUser = null
  }
}))
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig()),
  doc: (...p) => ({ path: p.slice(1).join('/') }),
  getDoc: async () => ({ exists: () => Boolean(m.userDoc), data: () => m.userDoc }),
  updateDoc: async (ref, data) => m.calls.push(['updateDoc', ref.path, data])
}))
vi.mock(`${SRC}/firebase/reportService.js`, () => ({
  submitReport: async (r) => {
    m.calls.push(['report', r])
    if (m.report instanceof Error) throw m.report
    return 'r1'
  }
}))
vi.mock(`${SRC}/notices/noticeService.js`, async (orig) => {
  const real = await orig()
  return {
    ...real,
    fetchMyNotices: async (args) => {
      m.calls.push(['fetchMyNotices', args])
      if (m.noticeError) throw m.noticeError
      return real.arrangeNotices(m.notices)
    },
    fetchNoticeReads: async () => m.reads,
    markNoticeRead: async (uid, gid) => m.calls.push(['markRead', uid, gid])
  }
})
vi.mock(`${SRC}/admin/services/adminCallable.js`, () => ({
  SESSION_ENDED_EVENT: 'x',
  callAdmin: async (name, data) => {
    m.calls.push([name, data])
    const r = m.callAdmin[name]
    if (r instanceof Error) throw r
    return typeof r === 'function' ? r(data) : r
  }
}))
vi.mock(`${SRC}/admin/hooks/useAdminSession.jsx`, () => ({ useAdminSession: () => ({ sessionToken: 'tok' }) }))

const { MemoryRouter, Route, Routes, useLocation } = await import('react-router-dom')
const { default: ChangeUsernamePage } = await import(`${SRC}/pages/ChangeUsernamePage.jsx`)
const { default: ChangeEmailPage } = await import(`${SRC}/pages/ChangeEmailPage.jsx`)
const { default: AccountSettingsPage } = await import(`${SRC}/pages/AccountSettingsPage.jsx`)
const { default: SecuritySettingsPage } = await import(`${SRC}/pages/SecuritySettingsPage.jsx`)
const { default: HelpSettingsPage } = await import(`${SRC}/pages/HelpSettingsPage.jsx`)
const { default: NoticeBoard } = await import(`${SRC}/notices/NoticeBoard.jsx`)
const { default: AdminNoticesPage } = await import(`${SRC}/admin/pages/AdminNoticesPage.jsx`)
const svc = await import(`${SRC}/notices/noticeService.js`)
const { isClaimableAlias, USERNAME_ALIAS_HOLD_MS } = await import(`${SRC}/firebase/usernameService.js`)

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname}</p>
}
const renderAt = (el, path = '/x') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path.split('?')[0]} element={el} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
const mkUser = (over = {}) => ({
  uid: 'u1',
  email: 'asha@example.test',
  emailVerified: true,
  providerData: [{ providerId: 'password' }],
  metadata: { creationTime: 'Mon, 01 Sep 2025 10:00:00 GMT', lastSignInTime: 'Mon, 10 Nov 2025 10:00:00 GMT' },
  reload: vi.fn(async () => {}),
  getIdToken: vi.fn(async () => 'x'),
  ...over
})
const fbErr = (code) => Object.assign(new Error(code), { code })
const T = Date.now()
const N = (id, over = {}) => ({ id, groupId: id, title: `Notice ${id}`, body: 'Body text', priority: 'normal', pinned: false, publishAtMs: T - 60_000, expiresAtMs: null, updatedAtMs: T - 60_000, ...over })

beforeEach(() => {
  m.auth.currentUser = mkUser()
  m.calls = []
  m.reserve = null
  m.reauth = null
  m.verifyBefore = null
  m.notices = []
  m.reads = {}
  m.noticeError = null
  m.callAdmin = {}
  m.report = null
  m.userDoc = null
  m.availability = true
  localStorage.clear()
})
afterEach(cleanup)

describe('notice service logic', () => {
  test('hides scheduled and expired notices; pinned → urgent → newest; dedupes', () => {
    const list = svc.arrangeNotices([
      N('old', { publishAtMs: T - 5e6 }),
      N('future', { publishAtMs: T + 6e4 }),
      N('expired', { expiresAtMs: T - 1 }),
      N('urgent', { priority: 'urgent', publishAtMs: T - 9e6 }),
      N('pinned', { pinned: true, publishAtMs: T - 9e7 }),
      N('old', { publishAtMs: T - 5e6 })
    ])
    expect(list.map((n) => n.groupId)).toEqual(['pinned', 'urgent', 'old'])
  })
  test('unread = never read or edited since; audience keys; safe links only', () => {
    expect(svc.isUnread(N('a'), {})).toBe(true)
    expect(svc.isUnread(N('a'), { a: T })).toBe(false)
    expect(svc.isUnread(N('a', { updatedAtMs: T + 10 }), { a: T })).toBe(true)
    expect(svc.audienceKeysFor({ uid: 'u1', collegeId: 'c1' })).toEqual(['all', 'uid:u1', 'college:c1'])
    expect(svc.audienceKeysFor({ uid: 'u1', collegeId: null })).toEqual(['all', 'uid:u1'])
    expect(svc.noticeLinkTarget('/communities')).toEqual({ type: 'internal', to: '/communities' })
    expect(svc.noticeLinkTarget('https://x.test/a')).toEqual({ type: 'external', href: 'https://x.test/a' })
    for (const bad of ['javascript:alert(1)', 'http://x.test', '//evil.test', 'data:text/html,x']) expect(svc.noticeLinkTarget(bad)).toBeNull()
  })
})

describe('Notice Board on the profile', () => {
  test('queries only this user’s audiences; shows notices, unread count, opens the full board and marks read', async () => {
    m.notices = [N('n1', { title: 'Happy Diwali!', body: 'Wishing everyone a bright Diwali.' }), N('n2', { title: 'Maintenance tonight' })]
    m.reads = { n2: T }
    renderAt(<NoticeBoard uid="u1" collegeId="c1" />)
    expect(await screen.findByText('Happy Diwali!')).toBeTruthy()
    expect(m.calls.find((c) => c[0] === 'fetchMyNotices')[1]).toEqual({ uid: 'u1', collegeId: 'c1' })
    expect(screen.getByLabelText('1 unread')).toBeTruthy()
    fireEvent.click(screen.getByText('Happy Diwali!').closest('button'))
    const dialog = await screen.findByRole('dialog', { name: 'Campinity Notice Board' })
    expect(within(dialog).getByText('Wishing everyone a bright Diwali.')).toBeTruthy()
    await waitFor(() => expect(m.calls).toContainEqual(['markRead', 'u1', 'n1']))
  })
  test('empty board explains itself; unexpected errors offer retry', async () => {
    renderAt(<NoticeBoard uid="u1" collegeId={null} />)
    expect(await screen.findByText(/No notices right now/)).toBeTruthy()
    cleanup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    m.noticeError = fbErr('internal')
    renderAt(<NoticeBoard uid="u1" collegeId={null} />)
    fireEvent.click(await screen.findByText(/Couldn't load notices/))
    await waitFor(() => expect(m.calls.filter((c) => c[0] === 'fetchMyNotices')).toHaveLength(3))
    warn.mockRestore()
  })
  test('offline offers a retry that says so', async () => {
    m.noticeError = fbErr('unavailable')
    renderAt(<NoticeBoard uid="u1" collegeId={null} />)
    expect(await screen.findByText(/You're offline/)).toBeTruthy()
  })
  test.each(['permission-denied', 'failed-precondition', 'not-found'])('backend not available (%s): calm empty board, no error shown to students', async (code) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    m.noticeError = fbErr(code)
    renderAt(<NoticeBoard uid="u1" collegeId={null} />)
    expect(await screen.findByText(/No notices right now/)).toBeTruthy()
    expect(screen.queryByText(/Couldn't load notices/)).toBeNull()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
  test('action links: in-app paths navigate inside Campinity; https opens a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    m.notices = [N('a', { title: 'Join the fest', actionUrl: '/communities', actionLabel: 'Explore' }), N('b', { title: 'Read more', actionUrl: 'https://campinity.example/news', actionLabel: 'News' })]
    renderAt(<NoticeBoard uid="u1" collegeId={null} />)
    fireEvent.click((await screen.findByText('Read more')).closest('button'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /News/ }))
    expect(open).toHaveBeenCalledWith('https://campinity.example/news', '_blank', 'noopener,noreferrer')
    fireEvent.click(within(dialog).getByRole('button', { name: /Explore/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/communities'))
  })
})

describe('Admin Notice Board', () => {
  test('lists notices; creating requires confirmation and sends the targeted payload', async () => {
    m.callAdmin.adminListNotices = { notices: [{ id: 'g1', title: 'Old notice', body: 'x', priority: 'normal', status: 'published', audience: { type: 'all' }, updatedAtMs: T, publishAtMs: T - 1e3 }], nextCursor: null }
    m.callAdmin.adminSearchUsers = { users: [{ uid: 'ux1', displayName: 'Rahul', username: 'rahul' }] }
    m.callAdmin.adminSaveNotice = (d) => ({ ok: true, notice: { id: 'g2', status: 'published', ...d.notice } })
    renderAt(<AdminNoticesPage />)
    expect(await screen.findByText('Old notice')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /New notice/ }))
    const drawer = await screen.findByRole('dialog', { name: 'New notice' })
    fireEvent.change(within(drawer).getByPlaceholderText('Happy Diwali from Campinity!'), { target: { value: 'Your ID card is ready' } })
    fireEvent.change(within(drawer).getByPlaceholderText(/Write the notice/), { target: { value: 'Collect it from the office.' } })
    fireEvent.click(within(drawer).getByRole('radio', { name: 'Specific users' }))
    fireEvent.change(within(drawer).getByLabelText('Find users'), { target: { value: 'rahul' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Search' }))
    fireEvent.click(await within(drawer).findByText('Rahul'))
    // preview shows exactly the student card
    expect(within(drawer).getAllByText('Your ID card is ready').length).toBeGreaterThan(0)
    fireEvent.click(within(drawer).getByRole('button', { name: /Publish/ }))
    expect(m.calls.some((c) => c[0] === 'adminSaveNotice')).toBe(false)
    const confirmTitle = await screen.findByText('Publish this notice?')
    fireEvent.click(within(confirmTitle.closest('[role=dialog]')).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(m.calls.some((c) => c[0] === 'adminSaveNotice')).toBe(true))
    const sent = m.calls.find((c) => c[0] === 'adminSaveNotice')[1]
    expect(sent).toMatchObject({ publish: true, notice: { title: 'Your ID card is ready', audience: { type: 'users', uids: ['ux1'] } } })
  })
  test('archive and delete are confirmed first', async () => {
    m.callAdmin.adminListNotices = { notices: [{ id: 'g1', title: 'Fest', body: 'x', priority: 'normal', status: 'published', audience: { type: 'all' }, updatedAtMs: T, publishAtMs: T - 1e3 }], nextCursor: null }
    m.callAdmin.adminSetNoticeState = { ok: true }
    renderAt(<AdminNoticesPage />)
    await screen.findByText('Fest')
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(m.calls.some((c) => c[0] === 'adminSetNoticeState')).toBe(false)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(m.calls).toContainEqual(['adminSetNoticeState', { sessionToken: 'tok', id: 'g1', action: 'archive' }]))
  })
})

describe('Change username', () => {
  test('live availability, then a real reservation with the old name released as alias', async () => {
    renderAt(<ChangeUsernamePage />)
    expect(screen.getByText('@asha')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('new_username'), { target: { value: 'Asha_Rao' } })
    expect(await screen.findByText('@asha_rao is available', {}, { timeout: 2000 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }))
    expect(await screen.findByText(/Your username is now/)).toBeTruthy()
    expect(m.calls.find((c) => c[0] === 'reserve')[1]).toEqual({ uid: 'u1', newUsername: 'asha_rao', oldUsername: 'asha' })
  })
  test('taken, invalid and race-lost names are rejected with clear messages', async () => {
    m.availability = false
    renderAt(<ChangeUsernamePage />)
    fireEvent.change(screen.getByPlaceholderText('new_username'), { target: { value: 'taken_name' } })
    expect(await screen.findByText('That username is taken', {}, { timeout: 2000 })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change username' }).disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('new_username'), { target: { value: 'ab' } })
    expect(await screen.findByText(/at least 3/)).toBeTruthy()
    m.availability = true
    m.reserve = Object.assign(new Error('taken'), { code: 'username-taken' })
    fireEvent.change(screen.getByPlaceholderText('new_username'), { target: { value: 'free_now' } })
    await screen.findByText('@free_now is available', {}, { timeout: 2000 })
    fireEvent.click(screen.getByRole('button', { name: 'Change username' }))
    expect(await screen.findByText(/Someone just took that username/)).toBeTruthy()
  })
  test('alias hold: own and expired aliases are claimable, a fresh one is not', () => {
    const at = (ms) => ({ toMillis: () => ms })
    expect(isClaimableAlias({ releasedAt: at(Date.now() - 1000) })).toBe(false)
    expect(isClaimableAlias({ releasedAt: at(Date.now() - USERNAME_ALIAS_HOLD_MS - 1000) })).toBe(true)
    expect(isClaimableAlias({})).toBe(false)
  })
})

describe('Change email', () => {
  const fill = (email, pw) => {
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } })
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: pw } })
  }
  test('re-authenticates, then uses verifyBeforeUpdateEmail — the email does NOT change yet', async () => {
    renderAt(<ChangeEmailPage />)
    fill('new@example.test', 'secret1')
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation link' }))
    expect(await screen.findByText(/Your email changes only after you open it/)).toBeTruthy()
    expect(m.calls.filter((c) => c[0] === 'reauth')).toEqual([['reauth', 'secret1']])
    const v = m.calls.find((c) => c[0] === 'verifyBeforeUpdateEmail')
    expect(v[1]).toBe('new@example.test')
    expect(v[2].url).toMatch(/\/settings\/email\?changed=1$/)
    expect(m.auth.currentUser.email).toBe('asha@example.test')
    expect(screen.getByText('Waiting for confirmation')).toBeTruthy()
  })
  test.each([
    ['auth/wrong-password', 'reauth', 'Your current password is incorrect.'],
    ['auth/email-already-in-use', 'verify', 'Another account already uses that email.'],
    ['auth/too-many-requests', 'verify', /Too many attempts/]
  ])('%s is explained', async (code, where, msg) => {
    if (where === 'reauth') m.reauth = fbErr(code)
    else m.verifyBefore = fbErr(code)
    renderAt(<ChangeEmailPage />)
    fill('new@example.test', 'pw')
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation link' }))
    expect(await screen.findByText(msg)).toBeTruthy()
  })
  test('rejected continue URL still sends the link (without it)', async () => {
    m.verifyBefore = (settings) => {
      if (settings) throw fbErr('auth/unauthorized-continue-uri')
    }
    renderAt(<ChangeEmailPage />)
    fill('new@example.test', 'pw')
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation link' }))
    expect(await screen.findByText(/We sent a confirmation link/)).toBeTruthy()
    expect(m.calls.filter((c) => c[0] === 'verifyBeforeUpdateEmail')).toHaveLength(2)
  })
  test('local checks: same email, invalid email, missing password — no Firebase calls', async () => {
    renderAt(<ChangeEmailPage />)
    fill('asha@example.test', 'pw')
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation link' }))
    expect(await screen.findByText("That's already your email.")).toBeTruthy()
    fill('not-an-email', 'pw')
    fireEvent.click(screen.getByRole('button', { name: 'Send confirmation link' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy()
    expect(m.calls.some((c) => c[0] === 'reauth')).toBe(false)
  })
  test('completion: once Firebase reports the new email, the session refreshes and the legacy profile field syncs', async () => {
    localStorage.setItem('campinity:pendingEmailChange:u1', JSON.stringify({ email: 'new@example.test', sentAt: T }))
    m.userDoc = { email: 'asha@example.test' }
    m.auth.currentUser = mkUser({
      reload: vi.fn(async function () {
        m.auth.currentUser.email = 'new@example.test'
      })
    })
    renderAt(<ChangeEmailPage />)
    expect(await screen.findByText('Your email is now new@example.test.')).toBeTruthy()
    expect(m.auth.currentUser.getIdToken).toHaveBeenCalledWith(true)
    expect(m.calls).toContainEqual(['updateDoc', 'users/u1', { email: 'new@example.test' }])
    expect(localStorage.getItem('campinity:pendingEmailChange:u1')).toBeNull()
  })
  test('session revoked by the email change → signed out and sent to log in', async () => {
    m.auth.currentUser = mkUser({
      reload: vi.fn(async () => {
        throw fbErr('auth/user-token-expired')
      })
    })
    renderAt(<ChangeEmailPage />)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login'))
    expect(m.calls).toContainEqual(['signOut'])
  })
  test('Google-only accounts are told their email is managed by Google', () => {
    m.auth.currentUser = mkUser({ providerData: [{ providerId: 'google.com' }] })
    renderAt(<ChangeEmailPage />)
    expect(screen.getByText(/managed by your Google account/)).toBeTruthy()
    expect(screen.queryByLabelText('Current password')).toBeNull()
  })
})

describe('Account, Security and Help', () => {
  test('Account shows real account information and links to every real flow', () => {
    renderAt(<AccountSettingsPage />)
    for (const t of ['Edit profile', 'Username', 'Email address', 'Password', 'Verified Campus Member', 'Email & password']) expect(screen.getAllByText(t).length).toBeGreaterThan(0)
    expect(screen.getByText('@asha')).toBeTruthy()
    expect(screen.getByText('asha@example.test')).toBeTruthy()
  })
  test('Security: real actions; unsupported features are labelled, not faked; logout works', async () => {
    m.auth.currentUser = mkUser({ emailVerified: false })
    renderAt(<SecuritySettingsPage />)
    expect(screen.getAllByText('Not available yet')).toHaveLength(3)
    expect(screen.getByText('Verify your email to keep your account secure')).toBeTruthy()
    fireEvent.click(screen.getByText('Log out of this device'))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login'))
  })
  test('Report a problem goes into the existing moderation pipeline', async () => {
    renderAt(<HelpSettingsPage />)
    fireEvent.click(screen.getByText('Report a problem'))
    fireEvent.change(screen.getByLabelText('Problem details'), { target: { value: 'The notice board does not open on my phone.' } })
    fireEvent.click(screen.getByRole('button', { name: /Send report/ }))
    expect(await screen.findByText(/reached the Campinity team/)).toBeTruthy()
    const r = m.calls.find((c) => c[0] === 'report')[1]
    expect(r).toMatchObject({ reporterUid: 'u1', targetType: 'app_problem', reason: 'bug' })
    expect(r.details).toContain('1.0.0-test')
  })
})
