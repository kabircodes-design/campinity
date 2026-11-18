// Integration: the deployed radarNearby source (functions/functions/radar.js)
// driven through the REAL firebase-admin SDK against the local Firestore
// emulator (demo project — never production). Proves hidden users and
// blocking in both directions are excluded, stale/far people are dropped,
// and output is only { uid, distanceMeters } with rounded distances.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const FUNCTIONS = path.resolve(here, '..', '..', 'functions', 'functions')
const require = createRequire(path.join(FUNCTIONS, 'index.js'))
const PORT = process.env.FIRESTORE_EMULATOR_PORT || '8089'
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`

const admin = require('firebase-admin')
const { HttpsError } = require('firebase-functions/v2/https')
const radar = require(path.join(FUNCTIONS, 'radar.js'))

const PROJECT = 'demo-campinity-rules'
const app = admin.initializeApp({ projectId: PROJECT }, 'radar-int')
const db = app.firestore()
const { FieldValue, Timestamp } = admin.firestore

const BASE = { lat: 19.0728, lng: 72.8826 }
const north = (m) => ({ lat: BASE.lat + m * 0.000009, lng: BASE.lng })

async function place(uid, meters, { ageMs = 60_000 } = {}) {
  const p = north(meters)
  await db.doc(`radarLocations/${uid}`).set({
    geohash: radar.encodeGeohash(p.lat, p.lng, 9),
    lat: p.lat,
    lng: p.lng,
    accuracy: 20,
    updatedAt: Timestamp.fromMillis(Date.now() - ageMs)
  })
}

let handler
beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  const users = {
    caller: {},
    visible: { displayName: 'Visible' },
    hidden: { displayName: 'Hidden', radarVisible: false },
    iBlocked: { displayName: 'I blocked them' },
    blockedMe: { displayName: 'They blocked me' },
    stale: { displayName: 'Stale' },
    far: { displayName: 'Far' },
    legacy: { displayName: 'Never set visibility' }
  }
  await Promise.all(Object.entries(users).map(([uid, d]) => db.doc(`users/${uid}`).set(d)))
  await db.doc('users/caller/blockedUsers/iBlocked').set({ at: FieldValue.serverTimestamp() })
  await db.doc('users/blockedMe/blockedUsers/caller').set({ at: FieldValue.serverTimestamp() })
  await place('visible', 42)
  await place('hidden', 30)
  await place('iBlocked', 20)
  await place('blockedMe', 25)
  await place('stale', 15, { ageMs: 11 * 60_000 })
  await place('far', 450)
  await place('legacy', 130)
  handler = radar.makeRadarNearbyHandler({ db, FieldValue, HttpsError })
})

afterAll(async () => {
  await app.delete()
})

describe('radarNearby (real Admin SDK, Firestore emulator)', () => {
  test('returns only visible, non-blocked, fresh, in-range people — uid + rounded distance only', async () => {
    const res = await handler({ auth: { uid: 'caller' }, data: { ...BASE, accuracy: 15 } })
    expect(res).toEqual({
      nearby: [
        { uid: 'visible', distanceMeters: 40 },
        { uid: 'legacy', distanceMeters: 150 }
      ]
    })
    expect(JSON.stringify(res)).not.toMatch(/lat|lng|geohash|accuracy/)
  })

  test("the caller's own location is stored server-side with a server timestamp", async () => {
    const snap = await db.doc('radarLocations/caller').get()
    expect(snap.exists).toBe(true)
    expect(Object.keys(snap.data()).sort()).toEqual(['accuracy', 'geohash', 'lat', 'lng', 'updatedAt'])
  })

  test('an immediate second lookup is rate-limited', async () => {
    await expect(handler({ auth: { uid: 'caller' }, data: BASE })).rejects.toMatchObject({ code: 'resource-exhausted' })
  })

  test('a hidden caller gets nothing and their stored location is removed', async () => {
    await db.doc('users/hidden').set({ radarVisible: false }, { merge: true })
    await expect(handler({ auth: { uid: 'hidden' }, data: BASE })).resolves.toEqual({ nearby: [] })
    expect((await db.doc('radarLocations/hidden').get()).exists).toBe(false)
  })

  test('unauthenticated and invalid input are refused', async () => {
    await expect(handler({ data: BASE })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(handler({ auth: { uid: 'visible' }, data: { lat: 200, lng: 0 } })).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})
