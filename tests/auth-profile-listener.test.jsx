// useAuthUser: a transient profile-listener error right after sign-in must not
// leave a finished account with profile = null (which routed it into
// onboarding until a reload). Firebase mocked; real hook.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({ authCb: null, subs: [] }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: {}, db: {}, storage: {}, default: {} }))
vi.mock(`${SRC}/firebase/presenceService.js`, () => ({ HEARTBEAT_INTERVAL_MS: 60000, touchPresence: async () => {} }))
vi.mock(`${SRC}/hooks/useAuthorEnrichment.js`, () => ({ primeAuthorCache: () => {} }))
vi.mock(`${SRC}/auth/utils/accountLocalData.js`, () => ({ syncAccountLocalData: () => {} }))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_a, cb) => { m.authCb = cb; return () => {} } }))
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...p) => p.join('/'),
  onSnapshot: (ref, next, error) => { const s = { ref, next, error, active: true }; m.subs.push(s); return () => { s.active = false } }
}))

const { useAuthUser } = await import(`${SRC}/auth/hooks/useAuthUser.js`)
let state
function Probe() { state = useAuthUser(); return null }
const snap = (data) => ({ exists: () => !!data, data: () => data, metadata: { fromCache: false } })

beforeEach(() => { vi.useFakeTimers(); m.subs = []; m.authCb = null; state = null })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('profile listener', () => {
  test('retries after a transient error and ends with the real profile, never settling on null meanwhile', async () => {
    render(<Probe />)
    act(() => m.authCb({ uid: 'u1', emailVerified: true }))
    expect(m.subs).toHaveLength(1)
    act(() => m.subs[0].error({ code: 'permission-denied' }))
    expect(state.profileSettled).toBe(false) // not routed anywhere off a null profile
    act(() => vi.advanceTimersByTime(10000)) // past the 4s safety net too
    expect(state.profileSettled).toBe(false)
    expect(m.subs).toHaveLength(2)
    act(() => m.subs[1].next(snap({ fullName: 'Alice Mehta', profileCompleted: true })))
    expect(state.profileSettled).toBe(true)
    expect(state.profile.profileCompleted).toBe(true)
  })

  test('gives up after the bounded retries and settles (offline / truly denied)', () => {
    render(<Probe />)
    act(() => m.authCb({ uid: 'u1', emailVerified: true }))
    for (let i = 0; i < 5; i++) {
      act(() => m.subs[m.subs.length - 1].error({ code: 'unavailable' }))
      act(() => vi.advanceTimersByTime(10000))
    }
    expect(m.subs).toHaveLength(5) // first try + 4 retries
    expect(state.profileSettled).toBe(true)
    expect(state.profile).toBeNull()
  })

  test('a retry scheduled for a previous account never subscribes after sign-out', () => {
    render(<Probe />)
    act(() => m.authCb({ uid: 'u1', emailVerified: true }))
    act(() => m.subs[0].error({ code: 'unavailable' }))
    act(() => m.authCb(null))
    act(() => vi.advanceTimersByTime(10000))
    expect(m.subs).toHaveLength(1)
    expect(state.user).toBeNull()
  })
})
