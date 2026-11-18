// Client side of admin device authorization:
//  1. proofs made by the app's requestProof.js verify with the SERVER's own
//     verifier (adminDevice.js) — byte-for-byte protocol compatibility,
//     using a real WebCrypto P-256 key like a browser device;
//  2. the lock screen flows (backend outdated, enrollment, login, revoked
//     device, wrong password) with the auth service mocked.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRequire } from 'node:module'
import path from 'node:path'
import { webcrypto } from 'node:crypto'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const svc = vi.hoisted(() => ({ calls: [], caps: null, exists: true, login: null, enroll: null }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: {}, db: {}, storage: {}, default: {} }))
vi.mock(`${SRC}/admin/services/adminAuthService.js`, () => ({
  getAdminCapabilities: async () => {
    svc.calls.push(['caps'])
    if (svc.caps instanceof Error) throw svc.caps
    return svc.caps
  },
  checkAdminPasswordExists: async () => svc.exists,
  setAdminPassword: async () => true,
  adminLogin: async (args) => {
    svc.calls.push(['login', args])
    if (svc.login instanceof Error) throw svc.login
    return svc.login
  },
  enrollThisDevice: async (args) => {
    svc.calls.push(['enroll', args])
    if (svc.enroll instanceof Error) throw svc.enroll
    if (svc.enroll?.ok) localStorage.setItem('campinity-admin:device', JSON.stringify({ deviceId: 'e'.repeat(32), label: args.label }))
    return svc.enroll
  },
  adminLogout: async () => {}
}))
vi.mock(`${SRC}/admin/security/deviceKey.js`, async (orig) => ({
  ...(await orig()),
  resetDeviceKey: async () => {
    svc.calls.push(['reset'])
    localStorage.removeItem('campinity-admin:device')
  }
}))

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto

const requireFn = createRequire(path.join(SRC, '..', 'functions', 'functions', 'index.js'))
const server = requireFn(path.join(SRC, '..', 'functions', 'functions', 'adminDevice.js'))._internal
const { attachDeviceProof, stableStringify, messages } = await import(`${SRC}/admin/security/requestProof.js`)
const { AdminSessionProvider, useAdminSession } = await import(`${SRC}/admin/hooks/useAdminSession.jsx`)
const { default: AdminLockScreen } = await import(`${SRC}/admin/components/AdminLockScreen.jsx`)

const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString('base64')

describe('request proof protocol matches the server', () => {
  test('stableStringify is identical to the server implementation', () => {
    const v = { b: 1, a: { d: [3, { z: null, y: 'x' }], c: true }, s: 'é"\\n' }
    expect(stableStringify(v)).toBe(server.stableStringify(v))
    expect(messages.call('h', 1, 'n', 'b')).toBe(server.messages.call('h', 1, 'n', 'b'))
    expect(messages.login('c', 'n', 'd')).toBe(server.messages.login('c', 'n', 'd'))
    expect(messages.enroll('c', 'n')).toBe(server.messages.enroll('c', 'n'))
  })

  test('a browser (WebCrypto) device proof verifies with the server verifier; undefined fields are dropped like the callable protocol', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
    const spki = b64(await crypto.subtle.exportKey('spki', pair.publicKey))
    const sign = async (m) => b64(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(m)))
    const data = { sessionToken: 'tok-123', uid: 'u1', status: 'suspended', cursor: undefined, nested: { b: 2, a: 1 } }
    const sent = await attachDeviceProof(data, { sign })
    expect('cursor' in sent).toBe(false)
    // What the server sees after JSON transport:
    const received = JSON.parse(JSON.stringify(sent))
    const msg = server.messages.call(server.sha256hex('tok-123'), received.deviceProof.ts, received.deviceProof.nonce, server.bodyHashOf(received))
    expect(server.verifySignature(spki, msg, received.deviceProof.sig)).toBe(true)
    // Any change to the body breaks the proof
    const tampered = { ...received, status: 'active' }
    const msg2 = server.messages.call(server.sha256hex('tok-123'), received.deviceProof.ts, received.deviceProof.nonce, server.bodyHashOf(tampered))
    expect(server.verifySignature(spki, msg2, received.deviceProof.sig)).toBe(false)
  })

  test('every proof gets a fresh nonce', async () => {
    const sign = async () => 'sig'
    const a = await attachDeviceProof({ sessionToken: 't' }, { sign })
    const b = await attachDeviceProof({ sessionToken: 't' }, { sign })
    expect(a.deviceProof.nonce).not.toBe(b.deviceProof.nonce)
    expect(a.deviceProof.nonce).toMatch(/^[a-f0-9]{32}$/)
  })
})

function Probe() {
  const { isLoggedIn, sessionToken } = useAdminSession()
  return <p data-testid="state">{isLoggedIn ? `in:${sessionToken}` : 'out'}</p>
}
const renderLock = () =>
  render(
    <AdminSessionProvider>
      <AdminLockScreen accountLabel="owner@example.test" onSignOut={() => svc.calls.push(['signout'])} />
      <Probe />
    </AdminSessionProvider>
  )
const SESSION = { sessionToken: 'new-session', expiresAtMs: Date.now() + 3600_000, deviceId: 'e'.repeat(32) }

beforeEach(() => {
  localStorage.clear()
  svc.calls = []
  svc.caps = { apiVersion: 2, deviceAuth: true, verificationListReadOnly: true }
  svc.exists = true
  svc.login = { ok: true, session: SESSION }
  svc.enroll = { ok: true, session: SESSION }
})
afterEach(cleanup)

describe('lock screen', () => {
  test('older backend: sign-in is disabled entirely (nothing else is called)', async () => {
    svc.caps = Object.assign(new Error('old'), { code: 'admin/backend-outdated' })
    renderLock()
    expect(await screen.findByText('Admin backend not updated yet')).toBeTruthy()
    expect(screen.queryByLabelText('Admin password')).toBeNull()
    expect(svc.calls.map((c) => c[0])).toEqual(['caps'])
  })

  test('unenrolled device: enrollment form; wrong password stays locked; success unlocks', async () => {
    renderLock()
    expect(await screen.findByText(/isn't authorized yet/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Enrollment code'), { target: { value: 'abcd-efgh-jkmn' } })
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    svc.enroll = { ok: false }
    fireEvent.click(screen.getByRole('button', { name: 'Authorize this device' }))
    expect(await screen.findByText('Incorrect password.')).toBeTruthy()
    expect(screen.getByTestId('state').textContent).toBe('out')

    svc.enroll = { ok: true, session: SESSION }
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Authorize this device' }))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('in:new-session'))
    expect(svc.calls.find((c) => c[0] === 'enroll')[1]).toMatchObject({ enrollmentCode: 'ABCD-EFGH-JKMN', password: 'pw' })
    expect(JSON.parse(localStorage.getItem('campinity-admin:session')).sessionToken).toBe('new-session')
  })

  test('short or missing code is caught before calling the server', async () => {
    renderLock()
    await screen.findByText(/isn't authorized yet/)
    fireEvent.change(screen.getByLabelText('Enrollment code'), { target: { value: 'ABC' } })
    fireEvent.click(screen.getByRole('button', { name: 'Authorize this device' }))
    expect(await screen.findByText(/12-character/)).toBeTruthy()
    expect(svc.calls.some((c) => c[0] === 'enroll')).toBe(false)
  })

  test('enrolled device: password unlocks with this deviceId', async () => {
    localStorage.setItem('campinity-admin:device', JSON.stringify({ deviceId: 'a'.repeat(32), label: 'Pixel' }))
    renderLock()
    expect(await screen.findByText(/Authorized device: Pixel/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('in:new-session'))
    expect(svc.calls.find((c) => c[0] === 'login')[1]).toEqual({ password: 'pw', deviceId: 'a'.repeat(32) })
  })

  test('revoked device: shows the server reason and offers re-enrollment (which resets the key)', async () => {
    localStorage.setItem('campinity-admin:device', JSON.stringify({ deviceId: 'a'.repeat(32), label: 'Pixel' }))
    svc.login = Object.assign(new Error('This device is not authorized for admin access.'), { code: 'functions/permission-denied' })
    renderLock()
    await screen.findByText(/Authorized device/)
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText('This device is not authorized for admin access.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /enroll it again/ }))
    expect(await screen.findByLabelText('Enrollment code')).toBeTruthy()
    expect(svc.calls.some((c) => c[0] === 'reset')).toBe(true)
  })

  test('rate limit and network errors are shown plainly', async () => {
    localStorage.setItem('campinity-admin:device', JSON.stringify({ deviceId: 'a'.repeat(32), label: 'Pixel' }))
    svc.login = Object.assign(new Error('Too many failed attempts. Try again in 15 min.'), { code: 'functions/resource-exhausted' })
    renderLock()
    await screen.findByText(/Authorized device/)
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText(/Too many failed attempts/)).toBeTruthy()
    svc.login = Object.assign(new Error('Failed to fetch'), { code: 'functions/internal' })
    fireEvent.change(screen.getByLabelText('Admin password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText(/No connection/)).toBeTruthy()
  })

  test('a stored session resumes after restart; an expired one does not', async () => {
    localStorage.setItem('campinity-admin:session', JSON.stringify({ sessionToken: 'kept', expiresAtMs: Date.now() + 60_000, deviceId: 'a'.repeat(32) }))
    const { unmount } = render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>
    )
    expect(screen.getByTestId('state').textContent).toBe('in:kept')
    unmount()
    localStorage.setItem('campinity-admin:session', JSON.stringify({ sessionToken: 'old', expiresAtMs: Date.now() - 1, deviceId: 'a'.repeat(32) }))
    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>
    )
    expect(screen.getByTestId('state').textContent).toBe('out')
  })

  test('server ending the session (revoked / expired) locks the panel and clears storage', async () => {
    localStorage.setItem('campinity-admin:session', JSON.stringify({ sessionToken: 'kept', expiresAtMs: Date.now() + 60_000, deviceId: 'a'.repeat(32) }))
    render(
      <AdminSessionProvider>
        <Probe />
      </AdminSessionProvider>
    )
    window.dispatchEvent(new CustomEvent('campinity-admin:session-ended', { detail: { message: 'This device is no longer authorized.' } }))
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('out'))
    expect(localStorage.getItem('campinity-admin:session')).toBeNull()
  })
})
