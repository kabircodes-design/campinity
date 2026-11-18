// Firestore security rules — authorised and unauthorised access for the
// prepared Radar-location and presence rules. Runs against the local
// Firestore emulator (demo project, no production access) started by
// tests/rules/run-rules-tests.mjs. Uses the app's own Firebase SDK with
// emulator mock tokens; seeding goes through the emulator's admin bypass.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  where,
  Timestamp
} from 'firebase/firestore'

const HOST = '127.0.0.1'
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8089)
const PROJECT = 'demo-campinity-rules'
const apps = []

function clientFor(uid) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key' }, `app-${uid || 'anon'}-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, HOST, PORT, uid ? { mockUserToken: { user_id: uid, sub: uid } } : undefined)
  return db
}

// Admin-bypass seed (emulator only): `Authorization: Bearer owner`.
async function seed(path, fields) {
  const toValue = (v) =>
    typeof v === 'number'
      ? { doubleValue: v }
      : typeof v === 'boolean'
        ? { booleanValue: v }
        : v instanceof Date
          ? { timestampValue: v.toISOString() }
          : v === null
            ? { nullValue: null }
            : { stringValue: String(v) }
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) }
  const res = await fetch(`http://${HOST}:${PORT}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`seed ${path}: ${res.status} ${await res.text()}`)
}

async function reset() {
  await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
}

const denied = (p) => expect(p).rejects.toMatchObject({ code: 'permission-denied' })
const allowed = (p) => expect(p).resolves.not.toThrow()

let alice, bob, carol, dave, anon
const validLocation = () => ({ geohash: 'te7ud2k1x', lat: 19.07, lng: 72.87, accuracy: 25, updatedAt: serverTimestamp() })

beforeAll(async () => {
  await reset()
  alice = clientFor('alice')
  bob = clientFor('bob')
  carol = clientFor('carol') // alice blocked carol
  dave = clientFor('dave') // dave blocked alice
  anon = clientFor(null)
  await seed('users/alice/blockedUsers/carol', { blockedAt: new Date() })
  await seed('users/dave/blockedUsers/alice', { blockedAt: new Date() })
  await seed('radarLocations/alice', { geohash: 'te7ud2k1x', lat: 19.07, lng: 72.87, accuracy: 25, updatedAt: new Date() })
  await seed('presence/alice', { lastActiveAt: new Date(), visible: true })
})

afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)))
})

describe('radarLocations — exact coordinates are owner-only', () => {
  test('owner can read their own location', () => allowed(getDoc(doc(alice, 'radarLocations/alice'))))
  test('another signed-in user cannot read it', () => denied(getDoc(doc(bob, 'radarLocations/alice'))))
  test('another user cannot list/query the collection (no alternative path)', () =>
    denied(getDocs(query(collection(bob, 'radarLocations'), where('geohash', '>=', 'te7'), where('geohash', '<=', 'te7')))))
  test('signed-out access is denied', () => denied(getDoc(doc(anon, 'radarLocations/alice'))))
  test('owner can write a well-formed location (existing app builds keep working)', () =>
    allowed(setDoc(doc(bob, 'radarLocations/bob'), validLocation())))
  test('owner cannot add extra fields', () =>
    denied(setDoc(doc(bob, 'radarLocations/bob'), { ...validLocation(), displayName: 'x' })))
  test('owner cannot write out-of-range coordinates', () =>
    denied(setDoc(doc(bob, 'radarLocations/bob'), { ...validLocation(), lat: 123 })))
  test('owner cannot back-date updatedAt (client clock)', () =>
    denied(setDoc(doc(bob, 'radarLocations/bob'), { ...validLocation(), updatedAt: Timestamp.fromDate(new Date(2020, 0, 1)) })))
  test("nobody can write someone else's location", () => denied(setDoc(doc(bob, 'radarLocations/alice'), validLocation())))
  test('owner can delete their location (Hidden)', () => allowed(deleteDoc(doc(bob, 'radarLocations/bob'))))
})

describe('existing users/{uid} behaviour is unchanged by the new rules', () => {
  test('profiles stay readable by signed-in users; owners can still edit their own profile', async () => {
    await seed('users/erin', { displayName: 'Erin', verifiedCampus: false, email: 'erin@example.test' })
    await allowed(getDoc(doc(bob, 'users/erin')))
    const erin = clientFor('erin')
    await allowed(setDoc(doc(erin, 'users/erin'), { bio: 'hello', radarVisible: false, activityStatusVisible: false }, { merge: true }))
  })
  test('other users still cannot edit a profile, and signed-out users cannot read it', async () => {
    await denied(setDoc(doc(bob, 'users/erin'), { bio: 'hacked' }, { merge: true }))
    await denied(getDoc(doc(anon, 'users/erin')))
  })
  test('existing owner-only subcollections are unaffected (notifications)', async () => {
    await seed('users/erin/notifications/n1', { type: 'like', read: false })
    await allowed(getDoc(doc(clientFor('erin'), 'users/erin/notifications/n1')))
    await denied(getDoc(doc(bob, 'users/erin/notifications/n1')))
  })
})

describe('private account data (email migration destination)', () => {
  test('owner can read their own private doc; others cannot; nobody can write from a client', async () => {
    await seed('users/alice/private/account', { email: 'alice@example.test' })
    await allowed(getDoc(doc(alice, 'users/alice/private/account')))
    await denied(getDoc(doc(bob, 'users/alice/private/account')))
    await denied(getDoc(doc(anon, 'users/alice/private/account')))
    await denied(setDoc(doc(alice, 'users/alice/private/account'), { email: 'x@example.test' }))
    await denied(setDoc(doc(bob, 'users/alice/private/account'), { email: 'x@example.test' }))
  })
})

describe('server-only counters', () => {
  test("clients cannot read or reset the TURN rate-limit counter (own or another user's)", async () => {
    await seed('turnRateLimits/alice', { count: 10, windowStartMs: 1 })
    await denied(getDoc(doc(alice, 'turnRateLimits/alice')))
    await denied(setDoc(doc(alice, 'turnRateLimits/alice'), { count: 0, windowStartMs: 1 }))
    await denied(deleteDoc(doc(alice, 'turnRateLimits/alice')))
    await denied(getDoc(doc(bob, 'turnRateLimits/alice')))
  })
})

describe('presence — block-aware and respects "Show activity status"', () => {
  test('owner can read and write their heartbeat', async () => {
    await allowed(setDoc(doc(alice, 'presence/alice'), { lastActiveAt: serverTimestamp() }, { merge: true }))
    await allowed(getDoc(doc(alice, 'presence/alice')))
  })
  test('an unrelated signed-in user can read it', () => allowed(getDoc(doc(bob, 'presence/alice'))))
  test('someone the owner blocked cannot read it', () => denied(getDoc(doc(carol, 'presence/alice'))))
  test('someone who blocked the owner cannot read it either', () => denied(getDoc(doc(dave, 'presence/alice'))))
  test('signed-out access is denied', () => denied(getDoc(doc(anon, 'presence/alice'))))
  test("nobody can write someone else's presence", () =>
    denied(setDoc(doc(bob, 'presence/alice'), { lastActiveAt: serverTimestamp() }, { merge: true })))
  test('heartbeat must be server time, and no extra fields', async () => {
    await denied(setDoc(doc(alice, 'presence/alice'), { lastActiveAt: Timestamp.fromDate(new Date(2020, 0, 1)) }, { merge: true }))
    await denied(setDoc(doc(alice, 'presence/alice'), { lastActiveAt: serverTimestamp(), extra: 1 }, { merge: true }))
  })
  test('when the owner hides activity status, others can no longer read it', async () => {
    await allowed(setDoc(doc(alice, 'presence/alice'), { visible: false, lastActiveAt: null }, { merge: true }))
    await denied(getDoc(doc(bob, 'presence/alice')))
    await allowed(getDoc(doc(alice, 'presence/alice')))
  })
})
