// Behaviour tests for the redesigned settings/feature pages (real components, Firebase mocked).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({ calls: [], profile: {}, prefs: {}, failNext: false, live: { activityStatusVisible: true } }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: { uid: 'u1' } }, db: {}, storage: {}, googleProvider: {}, default: {} }))
vi.mock(`${SRC}/theme/useTheme.js`, () => ({ useTheme: () => ({ mode: 'light', resolvedIsDark: false, setMode: () => {}, theme: { id: 'default' } }) }))
vi.mock(`${SRC}/context/AuthContext.jsx`, () => ({ useAuth: () => ({ user: { uid: 'u1' }, profile: m.live, loading: false }) }))
vi.mock(`${SRC}/firebase/profileService.js`, () => ({
  getUserProfile: async () => m.profile,
  updateUserProfile: async (uid, data) => {
    m.calls.push(['updateUserProfile', data])
    if (m.failNext) { m.failNext = false; throw new Error('Network down') }
  }
}))
vi.mock(`${SRC}/firebase/presenceService.js`, () => ({ setActivityStatusVisible: async (uid, v) => m.calls.push(['activity', v]) }))
vi.mock(`${SRC}/firebase/notificationService.js`, () => ({
  NOTIFICATION_PREFERENCE_DEFAULTS: { likes: true, comments: true, follows: true, messages: true, communities: true, announcements: true, calls: true },
  getNotificationPreferences: async () => m.prefs,
  updateNotificationPreferences: async (uid, next) => {
    m.calls.push(['prefs', next])
    if (m.failNext) { m.failNext = false; throw new Error('Could not save') }
  }
}))
vi.mock(`${SRC}/firebase/verificationService.js`, () => ({ submitVerificationRequest: async (args) => m.calls.push(['verify', args.collegeId, args.file.name]) }))

const { default: PrivacySettingsPage } = await import(`${SRC}/pages/PrivacySettingsPage.jsx`)
const { default: NotificationSettingsPage } = await import(`${SRC}/pages/NotificationSettingsPage.jsx`)
const { default: VerifyCollegePage } = await import(`${SRC}/pages/VerifyCollegePage.jsx`)
const { default: AboutSettingsPage } = await import(`${SRC}/pages/AboutSettingsPage.jsx`)

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname}</p>
}
const renderAt = (ui, path = '/x') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<>{ui}<Where /></>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  m.calls = []
  m.profile = { messagePrivacy: 'everyone', verifiedCampus: false, collegeId: 'c1' }
  m.prefs = { likes: true, comments: true, follows: false, messages: true, communities: true, announcements: true, calls: true }
  m.failNext = false
  m.live = { activityStatusVisible: true }
})
afterEach(cleanup)

describe('Privacy', () => {
  test('who-can-message is a real radiogroup reflecting the saved value and saving changes', async () => {
    renderAt(<PrivacySettingsPage />)
    const group = await screen.findByRole('radiogroup', { name: /who can message me/i })
    const [everyone, following] = within(group).getAllByRole('radio')
    expect(everyone.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(following)
    await waitFor(() => expect(m.calls).toContainEqual(['updateUserProfile', { messagePrivacy: 'following' }]))
    expect(following.getAttribute('aria-checked')).toBe('true')
    expect(await screen.findByRole('status')).toBeTruthy()
  })
  test('a failed save rolls the choice back and says so', async () => {
    m.failNext = true
    renderAt(<PrivacySettingsPage />)
    const group = await screen.findByRole('radiogroup')
    fireEvent.click(within(group).getAllByRole('radio')[1])
    await waitFor(() => expect(within(group).getAllByRole('radio')[0].getAttribute('aria-checked')).toBe('true'))
    expect((await screen.findByRole('status')).textContent).toMatch(/Network down/)
  })
  test('activity status is an accessible switch wired to presence', async () => {
    renderAt(<PrivacySettingsPage />)
    const sw = await screen.findByRole('switch', { name: 'Show activity status' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    await waitFor(() => expect(m.calls).toContainEqual(['activity', false]))
  })
})

describe('Notification settings', () => {
  test('switches reflect saved prefs, save on toggle, and summarise how many are on', async () => {
    renderAt(<NotificationSettingsPage />)
    const follows = await screen.findByRole('switch', { name: 'Follows' })
    expect(follows.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(/of 7 notification types are on/).textContent).toMatch(/6/)
    fireEvent.click(follows)
    await waitFor(() => expect(m.calls.find((c) => c[0] === 'prefs')?.[1].follows).toBe(true))
    expect(follows.getAttribute('aria-checked')).toBe('true')
  })
  test('a failed save reverts the switch', async () => {
    m.failNext = true
    renderAt(<NotificationSettingsPage />)
    const likes = await screen.findByRole('switch', { name: 'Likes' })
    fireEvent.click(likes)
    await waitFor(() => expect(likes.getAttribute('aria-checked')).toBe('true'))
    expect((await screen.findByRole('status')).textContent).toMatch(/Could not save/)
  })
})

describe('Campus verification', () => {
  const pick = (file) => fireEvent.change(document.getElementById('verification-file'), { target: { files: [file] } })
  test('rejects wrong types and oversized files before upload; submits a valid one', async () => {
    renderAt(<VerifyCollegePage />)
    await screen.findByText('Get the Campus Verified badge')
    pick(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/photo|PDF/i)
    const big = new File(['x'], 'huge.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    pick(big)
    expect((await screen.findByRole('alert')).textContent).toMatch(/10 MB/)
    pick(new File(['x'], 'id-card.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText('id-card.jpg')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect(m.calls).toContainEqual(['verify', 'c1', 'id-card.jpg']))
    expect(await screen.findByText('Submitted for review')).toBeTruthy()
  })
  test('already-verified students see their status, not the form', async () => {
    m.profile = { verifiedCampus: true, collegeId: 'c1' }
    renderAt(<VerifyCollegePage />)
    expect(await screen.findByText("You're already verified")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View my profile' }))
    expect(screen.getByTestId('where').textContent).toBe('/profile')
  })
})

describe('About', () => {
  test('shows the real version and policy links go to the right documents', async () => {
    renderAt(<AboutSettingsPage />)
    expect(screen.getByText(/Version/).textContent).toContain(__APP_VERSION__)
    fireEvent.click(screen.getByRole('button', { name: /Terms \(summary\)/ }))
    expect(screen.getByTestId('where').textContent).toBe('/settings/legal/terms')
  })
})
