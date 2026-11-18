// getTurnCredentials (functions/functions/turn.js) — auth, configuration,
// the per-user rate limit, and Cloudflare failure handling. In-memory
// Firestore and a fake fetch; no network, no real secrets.
import { describe, expect, test, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const turn = require(`${process.env.SRC_DIR}/../functions/functions/turn.js`)

class HttpsError extends Error {
  constructor(code, message, details) {
    super(message)
    this.code = code
    this.details = details
  }
}

function fakeDb() {
  const store = new Map()
  const ref = (path) => ({ path })
  return {
    store,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (fn) =>
      fn({
        get: async (r) => ({ exists: store.has(r.path), data: () => store.get(r.path) }),
        set: (r, value) => store.set(r.path, value)
      })
  }
}

const okFetch = () =>
  vi.fn(async () => ({
    ok: true,
    json: async () => ({ iceServers: { urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c' } })
  }))
const secrets = () => ({ keyId: 'key-id', token: 'secret-token' })
const T0 = Date.UTC(2026, 10, 15, 12, 0, 0)

describe('nextRateState', () => {
  test('first request opens a window', () => {
    expect(turn.nextRateState(null, T0)).toEqual({ allowed: true, state: { windowStartMs: T0, count: 1 } })
  })
  test(`allows up to ${turn.MAX_PER_WINDOW} per window, then refuses with a retry time`, () => {
    let state = null
    for (let i = 0; i < turn.MAX_PER_WINDOW; i++) {
      const r = turn.nextRateState(state, T0 + i * 1000)
      expect(r.allowed).toBe(true)
      state = r.state
    }
    const refused = turn.nextRateState(state, T0 + 20_000)
    expect(refused.allowed).toBe(false)
    expect(refused.retryAfterMs).toBe(turn.WINDOW_MS - 20_000)
  })
  test('a new window starts after the hour', () => {
    const full = { windowStartMs: T0, count: turn.MAX_PER_WINDOW }
    expect(turn.nextRateState(full, T0 + turn.WINDOW_MS)).toEqual({ allowed: true, state: { windowStartMs: T0 + turn.WINDOW_MS, count: 1 } })
  })
})

describe('getTurnCredentials handler', () => {
  test('requires sign-in', async () => {
    const handler = turn.makeTurnCredentialsHandler({ db: fakeDb(), HttpsError, fetchImpl: okFetch(), getSecrets: secrets })
    await expect(handler({})).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  test('refuses cleanly when secrets are not configured (and never calls Cloudflare)', async () => {
    const fetchImpl = okFetch()
    const handler = turn.makeTurnCredentialsHandler({ db: fakeDb(), HttpsError, fetchImpl, getSecrets: () => ({}) })
    await expect(handler({ auth: { uid: 'a' } })).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  test('returns only ICE servers + TTL; the API token goes to Cloudflare, never back to the client', async () => {
    const fetchImpl = okFetch()
    const handler = turn.makeTurnCredentialsHandler({ db: fakeDb(), HttpsError, fetchImpl, getSecrets: secrets, now: () => T0 })
    const res = await handler({ auth: { uid: 'a' } })
    expect(res).toEqual({ iceServers: [{ urls: ['turn:turn.cloudflare.com:3478'], username: 'u', credential: 'c' }], ttlSeconds: turn.TTL_SECONDS })
    expect(JSON.stringify(res)).not.toContain('secret-token')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers')
    expect(init.headers.Authorization).toBe('Bearer secret-token')
    expect(JSON.parse(init.body)).toEqual({ ttl: turn.TTL_SECONDS })
  })

  test('per-user limit: the 11th request in an hour is refused without calling Cloudflare; other users unaffected', async () => {
    const db = fakeDb()
    const fetchImpl = okFetch()
    let clock = T0
    const handler = turn.makeTurnCredentialsHandler({ db, HttpsError, fetchImpl, getSecrets: secrets, now: () => clock })
    for (let i = 0; i < turn.MAX_PER_WINDOW; i++) {
      clock = T0 + i * 1000
      await handler({ auth: { uid: 'a' } })
    }
    clock = T0 + 30_000
    await expect(handler({ auth: { uid: 'a' } })).rejects.toMatchObject({ code: 'resource-exhausted', details: { retryAfterSeconds: 3570 } })
    expect(fetchImpl).toHaveBeenCalledTimes(turn.MAX_PER_WINDOW)
    await expect(handler({ auth: { uid: 'b' } })).resolves.toHaveProperty('iceServers')
    clock = T0 + turn.WINDOW_MS
    await expect(handler({ auth: { uid: 'a' } })).resolves.toHaveProperty('iceServers')
  })

  test('Cloudflare failure surfaces as unavailable (no partial credentials)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    const handler = turn.makeTurnCredentialsHandler({ db: fakeDb(), HttpsError, fetchImpl, getSecrets: secrets })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(handler({ auth: { uid: 'a' } })).rejects.toMatchObject({ code: 'unavailable' })
    spy.mockRestore()
  })
})
