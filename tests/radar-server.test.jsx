// Server-side Radar proximity (functions/functions/radar.js) — the
// prepared radarNearby callable. Pure logic plus the handler with an
// in-memory Firestore stand-in; no emulator or network.
import { describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const radar = require(`${process.env.SRC_DIR}/../functions/functions/radar.js`)

// ~1 m of latitude ≈ 0.000009°
const at = (meters) => 19.07 + meters * 0.000009
const NOW = Date.UTC(2026, 10, 15, 10, 0, 0)

describe('parsePosition', () => {
  test('accepts valid coordinates', () => {
    expect(radar.parsePosition({ lat: 19.07, lng: 72.87, accuracy: 20 })).toEqual({ lat: 19.07, lng: 72.87, accuracy: 20 })
  })
  test.each([[{ lat: 91, lng: 0 }], [{ lat: 0, lng: 181 }], [{ lat: 'x', lng: 0 }], [{}], [{ lat: 0, lng: 0, accuracy: -1 }]])('rejects %j', (input) => {
    expect(() => radar.parsePosition(input)).toThrow()
  })
})

describe('roundDistance never reveals precise distance', () => {
  test.each([[1, 10], [14, 10], [16, 20], [99, 100], [124, 100], [126, 150], [290, 300]])('%d m -> %d m', (m, out) => {
    expect(radar.roundDistance(m)).toBe(out)
  })
})

describe('selectNearby', () => {
  const base = { callerUid: 'me', lat: 19.07, lng: 72.87, nowMs: NOW, isExcluded: () => false }
  const loc = (uid, meters, ageMs = 0) => ({ uid, lat: at(meters), lng: 72.87, updatedAtMs: NOW - ageMs })

  test('returns only uid + rounded distance, nearest first — never coordinates', () => {
    const out = radar.selectNearby({ ...base, candidates: [loc('far', 250), loc('near', 40)] })
    expect(out).toEqual([
      { uid: 'near', distanceMeters: 40 },
      { uid: 'far', distanceMeters: 250 }
    ])
    out.forEach((r) => expect(Object.keys(r).sort()).toEqual(['distanceMeters', 'uid']))
  })
  test('drops self, out-of-range, stale and duplicate entries', () => {
    const out = radar.selectNearby({
      ...base,
      candidates: [loc('me', 5), loc('out', 400), loc('stale', 20, 11 * 60 * 1000), loc('dup', 30), loc('dup', 30)]
    })
    expect(out.map((r) => r.uid)).toEqual(['dup'])
  })
  test('honours exclusions (hidden / blocked either way)', () => {
    const out = radar.selectNearby({ ...base, candidates: [loc('a', 30), loc('b', 30)], isExcluded: (uid) => uid === 'b' })
    expect(out.map((r) => r.uid)).toEqual(['a'])
  })
})

describe('radarNearby handler', () => {
  // Minimal in-memory Firestore shaped like the Admin SDK calls used.
  function fakeDb(docs) {
    const store = new Map(Object.entries(docs))
    const ref = (path) => ({
      get: async () => ({ exists: store.has(path), data: () => store.get(path), id: path.split('/').pop() }),
      set: async (value) => store.set(path, { ...value, updatedAt: { toMillis: () => NOW } }),
      delete: async () => store.delete(path),
      collection: (name) => col(`${path}/${name}`)
    })
    const col = (prefix) => ({
      doc: (id) => ref(`${prefix}/${id}`),
      where: (_f, _op1, low) => ({
        where: (_f2, _op2, high) => ({
          limit: () => ({
            get: async () => ({
              docs: [...store.entries()]
                .filter(([p, v]) => p.startsWith(`${prefix}/`) && p.split('/').length === 2 && v.geohash >= low && v.geohash <= high)
                .map(([p, v]) => ({ id: p.split('/')[1], data: () => v }))
            })
          })
        })
      })
    })
    return { db: { collection: (name) => col(name) }, store }
  }
  const FieldValue = { serverTimestamp: () => 'SERVER_TS' }
  class HttpsError extends Error {
    constructor(code, message) {
      super(message)
      this.code = code
    }
  }
  const locDoc = (meters) => ({
    geohash: radar.encodeGeohash(at(meters), 72.87, 9),
    lat: at(meters),
    lng: 72.87,
    updatedAt: { toMillis: () => NOW - 1000 }
  })

  function setup(extra = {}) {
    return fakeDb({
      'users/me': { displayName: 'Me' },
      'users/visible': { displayName: 'V' },
      'users/hidden': { displayName: 'H', radarVisible: false },
      'users/iblocked': { displayName: 'B1' },
      'users/blockedme': { displayName: 'B2' },
      'users/me/blockedUsers/iblocked': { at: 1 },
      'users/blockedme/blockedUsers/me': { at: 1 },
      'radarLocations/visible': locDoc(30),
      'radarLocations/hidden': locDoc(30),
      'radarLocations/iblocked': locDoc(30),
      'radarLocations/blockedme': locDoc(30),
      ...extra
    })
  }

  test('requires sign-in and valid input', async () => {
    const { db } = setup()
    const handler = radar.makeRadarNearbyHandler({ db, FieldValue, HttpsError, now: () => NOW })
    await expect(handler({ data: { lat: 1, lng: 1 } })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(handler({ auth: { uid: 'me' }, data: { lat: 999, lng: 1 } })).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  test('returns only visible, non-blocked people (both directions) and stores the caller server-side', async () => {
    const { db, store } = setup()
    const handler = radar.makeRadarNearbyHandler({ db, FieldValue, HttpsError, now: () => NOW })
    const res = await handler({ auth: { uid: 'me' }, data: { lat: 19.07, lng: 72.87, accuracy: 20 } })
    expect(res).toEqual({ nearby: [{ uid: 'visible', distanceMeters: 30 }] })
    expect(store.get('radarLocations/me')).toMatchObject({ lat: 19.07, lng: 72.87 })
  })

  test('rate-limited: a second lookup within 5s is refused', async () => {
    const { db } = setup()
    let clock = NOW
    const handler = radar.makeRadarNearbyHandler({ db, FieldValue, HttpsError, now: () => clock })
    await handler({ auth: { uid: 'me' }, data: { lat: 19.07, lng: 72.87 } })
    clock = NOW + 2000
    await expect(handler({ auth: { uid: 'me' }, data: { lat: 19.08, lng: 72.87 } })).rejects.toMatchObject({ code: 'resource-exhausted' })
    clock = NOW + 6000
    await expect(handler({ auth: { uid: 'me' }, data: { lat: 19.07, lng: 72.87 } })).resolves.toHaveProperty('nearby')
  })

  test('a hidden caller gets nothing and their location is removed', async () => {
    const { db, store } = setup({ 'users/me': { displayName: 'Me', radarVisible: false }, 'radarLocations/me': locDoc(0) })
    const handler = radar.makeRadarNearbyHandler({ db, FieldValue, HttpsError, now: () => NOW })
    await expect(handler({ auth: { uid: 'me' }, data: { lat: 19.07, lng: 72.87 } })).resolves.toEqual({ nearby: [] })
    expect(store.has('radarLocations/me')).toBe(false)
  })
})
