// Notice Board — the REAL admin callables (device-signed sessions) and the
// Firestore rules, both against the emulator (demo project, never prod).
// Also covers the users-rule hardening for usernames and the legacy email field.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeApp as initClient, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocFromServer, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, setDoc, Timestamp as ClientTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { seedDevice, seedSession, withProof } from './adminTestAuth.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const FUNCTIONS = path.resolve(here, '..', '..', 'functions', 'functions')
const require = createRequire(path.join(FUNCTIONS, 'index.js'))
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8089)
const PROJECT = 'demo-campinity-rules'
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`
process.env.GCLOUD_PROJECT = PROJECT
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT })

const fns = require(path.join(FUNCTIONS, 'index.js'))
const { makeNoticeHandlers } = require(path.join(FUNCTIONS, 'notices.js'))
const admin = require('firebase-admin')
const db = admin.firestore()
const { Timestamp } = admin.firestore
const { HttpsError } = require('firebase-functions/v2/https')

const ADMIN = 'notice-admin'
let SESSION
let DEV
const call = (name, data = {}) => fns[name].run({ data: withProof({ sessionToken: SESSION, ...data }, DEV.privateKey), auth: { uid: ADMIN }, rawRequest: { headers: {} } })
const base = (over = {}) => ({ title: 'Happy Diwali!', body: 'Wishing everyone a bright and safe Diwali.', priority: 'normal', audience: { type: 'all' }, ...over })
const deliveriesOf = async (groupId) => (await db.collection('notices').where('groupId', '==', groupId).get()).docs
const apps = []
function clientFor(uid, extra = {}) {
  const app = initClient({ projectId: PROJECT, apiKey: 'demo-key' }, `notice-${uid}-${apps.length}`)
  apps.push(app)
  const fdb = getFirestore(app)
  connectFirestoreEmulator(fdb, '127.0.0.1', PORT, { mockUserToken: { user_id: uid, sub: uid, ...extra } })
  return fdb
}
const denied = (p) => expect(p).rejects.toMatchObject({ code: 'permission-denied' })
// Mirrors src/notices/noticeService.js boardQuery(): the rules require both time filters.
const boardQuery = (fdb, key, { nowMs = Date.now(), margin = 60_000 } = {}) =>
  getDocs(
    query(
      collection(fdb, 'notices'),
      where('audienceKeys', 'array-contains', key),
      where('publishAt', '<=', ClientTimestamp.fromMillis(nowMs - margin)),
      where('expiresAt', '>', ClientTimestamp.fromMillis(nowMs + margin)),
      orderBy('publishAt', 'desc'),
      limit(20)
    )
  )
const groupIds = (snap) => snap.docs.map((d) => d.data().groupId)
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  DEV = await seedDevice(db, Timestamp, { uid: ADMIN })
  SESSION = await seedSession(db, Timestamp, { uid: ADMIN, deviceId: DEV.deviceId })
  await db.doc('colleges/c1').set({ name: 'North Campus' })
  await db.doc('colleges/c2').set({ name: 'South Campus' })
  await db.doc('users/alice').set({ displayName: 'Alice', username: 'alice', collegeId: 'c1', verifiedCampus: false })
  await db.doc('users/bob').set({ displayName: 'Bob', username: 'bob', collegeId: 'c2', verifiedCampus: false })
  await db.doc('users/carol').set({ displayName: 'Carol', username: 'carol', collegeId: 'c1', verifiedCampus: false })
})
afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)))
  await Promise.all(admin.apps.map((a) => a.delete()))
})

describe('admin endpoints are session + device gated', () => {
  test.each(['adminListNotices', 'adminSaveNotice', 'adminSetNoticeState', 'adminDeleteNotice', 'adminUploadNoticeImage'])('%s refuses without a session / without device proof', async (name) => {
    await expect(fns[name].run({ data: {}, auth: { uid: ADMIN }, rawRequest: { headers: {} } })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(fns[name].run({ data: { sessionToken: SESSION }, auth: { uid: ADMIN }, rawRequest: { headers: {} } })).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

describe('publishing and targeting', () => {
  test('draft has no deliveries; publish to everyone creates exactly one public delivery without admin identity', async () => {
    const { notice } = await call('adminSaveNotice', { notice: base() })
    expect(notice.status).toBe('draft')
    expect(await deliveriesOf(notice.id)).toHaveLength(0)
    const pub = await call('adminSetNoticeState', { id: notice.id, action: 'publish' })
    expect(pub.notice.deliveryCount).toBe(1)
    const [d] = await deliveriesOf(notice.id)
    expect(d.id).toBe(`${notice.id}__all`)
    expect(d.data()).toMatchObject({ audienceKeys: ['all'], title: 'Happy Diwali!', priority: 'normal' })
    expect(JSON.stringify(d.data())).not.toContain(ADMIN)
  })

  test('specific users: one delivery per recipient; the recipient list stays in the admin-only master', async () => {
    const { notice } = await call('adminSaveNotice', { notice: base({ title: 'Your ID card is ready', audience: { type: 'users', uids: ['alice', 'carol'] } }), publish: true })
    const ds = await deliveriesOf(notice.id)
    expect(ds.map((d) => d.data().audienceKeys[0]).sort()).toEqual(['uid:alice', 'uid:carol'])
    for (const d of ds) expect(JSON.stringify(d.data())).not.toMatch(/alice.*carol|carol.*alice/)
    expect((await db.doc(`noticeGroups/${notice.id}`).get()).data().audience.uids).toEqual(['alice', 'carol'])
  })

  test('campus targeting creates a single campus delivery', async () => {
    const { notice } = await call('adminSaveNotice', { notice: base({ title: 'North Campus fest', audience: { type: 'college', collegeId: 'c1' } }), publish: true })
    const ds = await deliveriesOf(notice.id)
    expect(ds.map((d) => d.data().audienceKeys)).toEqual([['college:c1']])
  })

  test('editing a published notice updates deliveries in place and removes dropped recipients', async () => {
    const { notice } = await call('adminSaveNotice', { notice: base({ title: 'Lab timings', audience: { type: 'users', uids: ['alice', 'bob'] } }), publish: true })
    await call('adminSaveNotice', { id: notice.id, notice: base({ title: 'Lab timings (updated)', audience: { type: 'users', uids: ['alice'] } }) })
    const ds = await deliveriesOf(notice.id)
    expect(ds.map((d) => d.id)).toEqual([`${notice.id}__u_alice`])
    expect(ds[0].data().title).toBe('Lab timings (updated)')
  })

  test('pin, archive, restore, delete keep deliveries consistent', async () => {
    const { notice } = await call('adminSaveNotice', { notice: base({ title: 'Maintenance' }), publish: true })
    await call('adminSetNoticeState', { id: notice.id, action: 'pin' })
    expect((await deliveriesOf(notice.id))[0].data().pinned).toBe(true)
    await call('adminSetNoticeState', { id: notice.id, action: 'archive' })
    expect(await deliveriesOf(notice.id)).toHaveLength(0)
    await expect(call('adminSaveNotice', { id: notice.id, notice: base({ title: 'x' }) })).rejects.toMatchObject({ code: 'failed-precondition' })
    await call('adminSetNoticeState', { id: notice.id, action: 'restore' })
    expect((await db.doc(`noticeGroups/${notice.id}`).get()).data().status).toBe('draft')
    await call('adminSetNoticeState', { id: notice.id, action: 'publish' })
    expect(await deliveriesOf(notice.id)).toHaveLength(1)
    await call('adminDeleteNotice', { id: notice.id })
    expect(await deliveriesOf(notice.id)).toHaveLength(0)
    expect((await db.doc(`noticeGroups/${notice.id}`).get()).exists).toBe(false)
  })

  test('schedule + expiry are stored on deliveries; list endpoint filters by status', async () => {
    const t0 = Date.now()
    const { notice } = await call('adminSaveNotice', { notice: base({ title: 'Tomorrow', publishAtMs: t0 + 86400000, expiresAtMs: t0 + 2 * 86400000 }), publish: true })
    const [d] = await deliveriesOf(notice.id)
    expect(d.data().publishAt.toMillis()).toBe(t0 + 86400000)
    expect(d.data().expiresAt.toMillis()).toBe(t0 + 2 * 86400000)
    const list = await call('adminListNotices', { status: 'published' })
    expect(list.notices.every((n) => n.status === 'published')).toBe(true)
    expect(list.notices.some((n) => n.id === notice.id)).toBe(true)
  })

  test('every change is audit-logged', async () => {
    const actions = (await db.collection('moderationActions').where('targetType', '==', 'notice').get()).docs.map((d) => d.data().action)
    for (const a of ['notice_drafted', 'notice_published', 'notice_edited', 'notice_pinned', 'notice_archived', 'notice_restored', 'notice_deleted']) expect(actions).toContain(a)
  })
})

describe('validation', () => {
  test.each([
    [{ title: '' }, /Title/],
    [{ title: 'x'.repeat(91) }, /Title/],
    [{ body: '' }, /Message/],
    [{ actionUrl: 'javascript:alert(1)' }, /https/],
    [{ actionUrl: 'http://example.com' }, /https/],
    [{ imageUrl: 'https://evil.example/x.png' }, /uploader/],
    [{ audience: { type: 'users', uids: ['ghost-user-123'] } }, /no longer exist/],
    [{ audience: { type: 'users', uids: [] } }, /at least one/],
    [{ audience: { type: 'college', collegeId: 'nope' } }, /does not exist/],
    [{ audience: { type: 'everyone-ish' } }, /who should see/],
    [{ publishAtMs: Date.now() + 10_000, expiresAtMs: Date.now() }, /Expiry/]
  ])('rejects %o', async (over, msg) => {
    await expect(call('adminSaveNotice', { notice: base(over) })).rejects.toMatchObject({ code: 'invalid-argument', message: expect.stringMatching(msg) })
  })
  test('accepts in-app paths and https links; caps users at 100', async () => {
    await expect(call('adminSaveNotice', { notice: base({ actionUrl: '/communities', actionLabel: 'Explore' }) })).resolves.toMatchObject({ ok: true })
    await expect(call('adminSaveNotice', { notice: base({ actionUrl: 'https://example.com/fest' }) })).resolves.toMatchObject({ ok: true })
    const many = Array.from({ length: 101 }, (_, i) => `user${String(i).padStart(10, '0')}`)
    await expect(call('adminSaveNotice', { notice: base({ audience: { type: 'users', uids: many } }) })).rejects.toMatchObject({ message: expect.stringMatching(/100/) })
  })
  test('banner upload: type, magic bytes and size are enforced; valid images get a tokenized URL', async () => {
    const saved = []
    const h = makeNoticeHandlers({
      db: () => db,
      admin,
      HttpsError,
      logAdminAction: async () => {},
      requireValidAdminSession: async () => ({ createdByUid: ADMIN }),
      bucket: () => ({ name: 'demo-bucket', file: (p) => ({ save: async (buf, opts) => saved.push({ p, size: buf.length, opts }) }) })
    })
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]).toString('base64')
    await expect(h.uploadNoticeImage({ data: { contentType: 'image/gif', dataBase64: png } })).rejects.toMatchObject({ message: /JPEG, PNG or WebP/ })
    await expect(h.uploadNoticeImage({ data: { contentType: 'image/jpeg', dataBase64: png } })).rejects.toMatchObject({ message: /doesn't look like/ })
    await expect(h.uploadNoticeImage({ data: { contentType: 'image/png', dataBase64: Buffer.alloc(2 * 1024 * 1024).toString('base64') } })).rejects.toMatchObject({ message: /1\.5 MB/ })
    const res = await h.uploadNoticeImage({ data: { contentType: 'image/png', dataBase64: png } })
    expect(res.imageUrl).toMatch(/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/demo-bucket\/o\/notices%2F[a-f0-9]{24}\.png\?alt=media&token=/)
    expect(saved[0].opts.contentType).toBe('image/png')
    expect(h._internal.cleanImageUrl(res.imageUrl)).toBe(res.imageUrl)
  })
})

describe('Firestore rules — who can read what', () => {
  let ids
  beforeAll(async () => {
    const mk = async (over) => (await call('adminSaveNotice', { notice: base(over), publish: true })).notice.id
    ids = {
      everyone: await mk({ title: 'For everyone' }),
      alice: await mk({ title: 'Only Alice', audience: { type: 'users', uids: ['alice'] } }),
      north: await mk({ title: 'North only', audience: { type: 'college', collegeId: 'c1' } })
    }
  })

  test('everyone notice is readable by any signed-in user via the board query', async () => {
    const snap = await boardQuery(clientFor('bob'), 'all')
    expect(snap.docs.some((d) => d.data().groupId === ids.everyone)).toBe(true)
  })

  test('personal notice: only its recipient can read it (query or direct get)', async () => {
    const own = await boardQuery(clientFor('alice'), 'uid:alice')
    expect(own.docs.map((d) => d.data().groupId)).toContain(ids.alice)
    await denied(boardQuery(clientFor('bob'), 'uid:alice'))
    await denied(getDoc(doc(clientFor('bob'), 'notices', `${ids.alice}__u_alice`)))
  })

  test('campus notice: readable by students of that campus only', async () => {
    const carol = await boardQuery(clientFor('carol'), 'college:c1')
    expect(carol.docs.map((d) => d.data().groupId)).toContain(ids.north)
    await denied(boardQuery(clientFor('bob'), 'college:c1'))
  })

  test('signed-out users read nothing; nobody can write notices or read admin master records', async () => {
    const anonApp = initClient({ projectId: PROJECT, apiKey: 'demo-key' }, `notice-anon-${apps.length}`)
    apps.push(anonApp)
    const anon = getFirestore(anonApp)
    connectFirestoreEmulator(anon, '127.0.0.1', PORT)
    await denied(boardQuery(anon, 'all'))
    const alice = clientFor('alice')
    await denied(setDoc(doc(alice, 'notices', 'fake'), { audienceKeys: ['all'], title: 'Fake', publishAt: serverTimestamp() }))
    await denied(updateDoc(doc(alice, 'notices', `${ids.everyone}__all`), { title: 'Hacked' }))
    await denied(deleteDoc(doc(alice, 'notices', `${ids.everyone}__all`)))
    await denied(getDoc(doc(alice, 'noticeGroups', ids.alice)))
  })

  test('read markers: owner-only, single server-timestamped field', async () => {
    const alice = clientFor('alice')
    await expect(setDoc(doc(alice, 'users', 'alice', 'noticeReads', ids.everyone), { readAt: serverTimestamp() })).resolves.toBeUndefined()
    await denied(setDoc(doc(alice, 'users', 'alice', 'noticeReads', ids.alice), { readAt: serverTimestamp(), extra: true }))
    await denied(setDoc(doc(alice, 'users', 'alice', 'noticeReads', ids.alice), { readAt: new Date(0) }))
    await denied(setDoc(doc(clientFor('bob'), 'users', 'alice', 'noticeReads', ids.everyone), { readAt: serverTimestamp() }))
    await denied(getDocs(collection(clientFor('bob'), 'users', 'alice', 'noticeReads')))
  })
})

describe('Firestore rules — publication window is enforced by the database', () => {
  const HOUR = 3600_000
  const DAY = 24 * HOUR
  let ids
  const mk = async (over, publish = true) => (await call('adminSaveNotice', { notice: base(over), publish })).notice.id
  // getDocFromServer: always ask the emulator (never the SDK cache), so each read is a real rules decision.
  const getDelivery = (fdb, id) => getDocFromServer(doc(fdb, 'notices', id))
  beforeAll(async () => {
    const t = Date.now()
    ids = {
      live: await mk({ title: 'Live now' }),
      pinned: await mk({ title: 'Pinned live', pinned: true, priority: 'urgent' }),
      expiring: await mk({ title: 'Live, expires tomorrow', expiresAtMs: t + DAY }),
      scheduledAll: await mk({ title: 'Scheduled everyone', publishAtMs: t + DAY }),
      scheduledUser: await mk({ title: 'Scheduled for Alice', publishAtMs: t + DAY, audience: { type: 'users', uids: ['alice'] } }),
      scheduledCampus: await mk({ title: 'Scheduled North', publishAtMs: t + DAY, audience: { type: 'college', collegeId: 'c1' } }),
      expiredAll: await mk({ title: 'Expired everyone', publishAtMs: t - 2 * HOUR, expiresAtMs: t - HOUR }),
      expiredUser: await mk({ title: 'Expired for Alice', publishAtMs: t - 2 * HOUR, expiresAtMs: t - HOUR, audience: { type: 'users', uids: ['alice'] } }),
      draft: await mk({ title: 'Draft only' }, false),
      archived: await mk({ title: 'Archived' })
    }
    await call('adminSetNoticeState', { id: ids.archived, action: 'archive' })
  })

  test('never-expiring deliveries store a non-null far-future expiry; the master keeps null', async () => {
    const [d] = await deliveriesOf(ids.live)
    expect(d.data().expiresAt.toMillis()).toBe(Date.UTC(9999, 0, 1))
    expect((await db.doc(`noticeGroups/${ids.live}`).get()).data().expiresAt).toBeNull()
    expect((await deliveriesOf(ids.expiring))[0].data().expiresAt.toMillis()).toBeLessThan(Date.UTC(3000, 0, 1))
  })

  test('published + pinned + not-yet-expired notices are readable (board query and direct get)', async () => {
    const bob = clientFor('bob')
    const got = groupIds(await boardQuery(bob, 'all'))
    expect(got).toEqual(expect.arrayContaining([ids.live, ids.pinned, ids.expiring]))
    expect((await getDelivery(bob, `${ids.pinned}__all`)).data().pinned).toBe(true)
    expect((await getDelivery(bob, `${ids.expiring}__all`)).exists()).toBe(true)
  })

  test('scheduled notices: deliveries exist server-side but direct reads before publishAt are DENIED', async () => {
    // The data really is there (so this is a rules test, not an absence test)…
    expect(await deliveriesOf(ids.scheduledAll)).toHaveLength(1)
    const alice = clientFor('alice')
    // …everyone notice: direct get denied, even for its audience
    await denied(getDelivery(alice, `${ids.scheduledAll}__all`))
    // …personal notice: denied for its own recipient before publish time
    await denied(getDelivery(alice, `${ids.scheduledUser}__u_alice`))
    // …campus notice: denied for a student of that campus
    await denied(getDelivery(clientFor('carol'), `${ids.scheduledCampus}__c_c1`))
  })

  test('scheduled notices: queries that could return them are DENIED; the board query never includes them', async () => {
    const alice = clientFor('alice')
    // A hand-written query without the publishAt bound is rejected outright.
    await denied(getDocs(query(collection(alice, 'notices'), where('audienceKeys', 'array-contains', 'uid:alice'))))
    await denied(getDocs(query(collection(alice, 'notices'), where('audienceKeys', 'array-contains', 'all'), where('expiresAt', '>', ClientTimestamp.fromMillis(Date.now() + 60_000)))))
    // Asking for "publishAt <= tomorrow" is rejected too — the bound must not be in the future.
    await denied(boardQuery(alice, 'all', { nowMs: Date.now() + 2 * DAY }))
    // The legitimate board query succeeds and excludes every scheduled notice.
    for (const key of ['all', 'uid:alice', 'college:c1']) {
      const got = groupIds(await boardQuery(alice, key))
      for (const s of [ids.scheduledAll, ids.scheduledUser, ids.scheduledCampus]) expect(got).not.toContain(s)
    }
  })

  test('expired notices: direct get and unbounded queries are DENIED; the board query excludes them', async () => {
    const alice = clientFor('alice')
    expect(await deliveriesOf(ids.expiredAll)).toHaveLength(1)
    await denied(getDelivery(alice, `${ids.expiredAll}__all`))
    await denied(getDelivery(alice, `${ids.expiredUser}__u_alice`))
    await denied(getDocs(query(collection(alice, 'notices'), where('audienceKeys', 'array-contains', 'all'), where('publishAt', '<=', ClientTimestamp.fromMillis(Date.now() - 60_000)))))
    // expiresAt bound in the past (could match expired docs) is rejected
    await denied(boardQuery(alice, 'all', { nowMs: Date.now() - 2 * DAY }))
    expect(groupIds(await boardQuery(alice, 'all'))).not.toContain(ids.expiredAll)
    expect(groupIds(await boardQuery(alice, 'uid:alice'))).not.toContain(ids.expiredUser)
  })

  test('drafts and archived notices have no deliveries and cannot be read; their masters stay admin-only', async () => {
    const alice = clientFor('alice')
    expect(await deliveriesOf(ids.draft)).toHaveLength(0)
    expect(await deliveriesOf(ids.archived)).toHaveLength(0)
    await denied(getDelivery(alice, `${ids.draft}__all`))
    await denied(getDelivery(alice, `${ids.archived}__all`))
    await denied(getDoc(doc(alice, 'noticeGroups', ids.draft)))
    await denied(getDoc(doc(alice, 'noticeGroups', ids.archived)))
    await denied(getDocs(collection(alice, 'noticeGroups')))
    const got = groupIds(await boardQuery(alice, 'all'))
    expect(got).not.toContain(ids.draft)
    expect(got).not.toContain(ids.archived)
  })

  test('targeting still holds inside the window: live personal/campus notices stay private', async () => {
    const pAlice = await mk({ title: 'Live for Alice', audience: { type: 'users', uids: ['alice'] } })
    const pNorth = await mk({ title: 'Live North', audience: { type: 'college', collegeId: 'c1' } })
    expect(groupIds(await boardQuery(clientFor('alice'), 'uid:alice'))).toContain(pAlice)
    expect(groupIds(await boardQuery(clientFor('carol'), 'college:c1'))).toContain(pNorth)
    await denied(getDelivery(clientFor('bob'), `${pAlice}__u_alice`))
    await denied(getDelivery(clientFor('bob'), `${pNorth}__c_c1`))
    await denied(boardQuery(clientFor('bob'), 'uid:alice'))
    await denied(boardQuery(clientFor('bob'), 'college:c1'))
  })

  test('a scheduled notice becomes readable once the server clock passes publishAt', async () => {
    const id = await mk({ title: 'Opens in 2s', publishAtMs: Date.now() + 2000, audience: { type: 'users', uids: ['alice'] } })
    await denied(getDelivery(clientFor('alice'), `${id}__u_alice`))
    await pause(3000)
    // fresh client: the SDK can keep serving a target's earlier outcome
    expect((await getDelivery(clientFor('alice'), `${id}__u_alice`)).data().title).toBe('Opens in 2s')
  })

  test('an expiring notice stops being readable once the server clock passes expiresAt', async () => {
    const id = await mk({ title: 'Closes in 2s', publishAtMs: Date.now() - 60_000, expiresAtMs: Date.now() + 2000, audience: { type: 'users', uids: ['alice'] } })
    expect((await getDelivery(clientFor('alice'), `${id}__u_alice`)).exists()).toBe(true)
    await pause(3000)
    await denied(getDelivery(clientFor('alice'), `${id}__u_alice`))
    await denied(boardQuery(clientFor('alice'), 'uid:alice', { nowMs: Date.now() - 10_000, margin: 0 }))
  })

  test('device clock skew: a 5-minute-fast clock is denied at the 1-minute margin and allowed at the 15-minute retry margin', async () => {
    const bob = clientFor('bob')
    await denied(boardQuery(bob, 'all', { nowMs: Date.now() + 5 * 60_000, margin: 60_000 }))
    await expect(boardQuery(bob, 'all', { nowMs: Date.now() + 5 * 60_000, margin: 15 * 60_000 })).resolves.toBeTruthy()
    await denied(boardQuery(bob, 'all', { nowMs: Date.now() - 5 * 60_000, margin: 60_000 }))
    await expect(boardQuery(bob, 'all', { nowMs: Date.now() - 5 * 60_000, margin: 15 * 60_000 })).resolves.toBeTruthy()
  })

  test('"publish immediately" is visible at once; edits keep the publish time of a live notice; publishing an old draft restarts it', async () => {
    const t = Date.now()
    const id = await mk({ title: 'Instant', audience: { type: 'users', uids: ['carol'] } })
    const pub1 = (await deliveriesOf(id))[0].data().publishAt.toMillis()
    expect(pub1).toBeLessThanOrEqual(t - 60_000)
    expect(groupIds(await boardQuery(clientFor('carol'), 'uid:carol'))).toContain(id)
    await call('adminSaveNotice', { id, notice: base({ title: 'Instant (edited)', audience: { type: 'users', uids: ['carol'] } }) })
    expect((await deliveriesOf(id))[0].data().publishAt.toMillis()).toBe(pub1)
    const draft = await mk({ title: 'Old draft', publishAtMs: t - 3 * DAY }, false)
    await call('adminSetNoticeState', { id: draft, action: 'publish' })
    const pub2 = (await deliveriesOf(draft))[0].data().publishAt.toMillis()
    expect(pub2).toBeGreaterThan(t - 5 * 60_000)
    const stale = await mk({ title: 'Stale draft', publishAtMs: t - 3 * DAY, expiresAtMs: t - 2 * DAY }, false)
    await expect(call('adminSetNoticeState', { id: stale, action: 'publish' })).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(await deliveriesOf(stale)).toHaveLength(0)
  })

  test('users cannot forge, edit, retarget or reschedule a delivery', async () => {
    const alice = clientFor('alice')
    await denied(updateDoc(doc(alice, 'notices', `${ids.live}__all`), { audienceKeys: ['uid:alice'] }))
    await denied(updateDoc(doc(alice, 'notices', `${ids.scheduledAll}__all`), { publishAt: ClientTimestamp.fromMillis(0) }))
    await denied(setDoc(doc(alice, 'notices', `${ids.scheduledUser}__u_alice`), { audienceKeys: ['uid:alice'], publishAt: ClientTimestamp.fromMillis(0), expiresAt: ClientTimestamp.fromMillis(Date.UTC(9999, 0, 1)) }))
    await denied(deleteDoc(doc(alice, 'notices', `${ids.expiredUser}__u_alice`)))
  })
})

describe('users rule hardening', () => {
  test('a username change must be reserved by the same user in the same write', async () => {
    const alice = clientFor('alice')
    await denied(updateDoc(doc(alice, 'users', 'alice'), { username: 'stolen_name' }))
    const b = writeBatch(alice)
    b.set(doc(alice, 'usernames', 'alice_new'), { uid: 'alice', createdAt: serverTimestamp() })
    b.update(doc(alice, 'users', 'alice'), { username: 'alice_new' })
    await expect(b.commit()).resolves.toBeUndefined()
    await expect(updateDoc(doc(alice, 'users', 'alice'), { bio: 'unchanged username is fine' })).resolves.toBeUndefined()
    await db.doc('usernames/bobs_name').set({ uid: 'bob' })
    await denied(updateDoc(doc(alice, 'users', 'alice'), { username: 'bobs_name' }))
  })

  test('renamed usernames stay reserved as aliases for 30 days, then become claimable', async () => {
    await db.doc('usernames/fresh_alias').set({ uid: 'alice', releasedAt: Timestamp.now(), aliasOf: 'alice_new' })
    await db.doc('usernames/old_alias').set({ uid: 'alice', releasedAt: Timestamp.fromMillis(Date.now() - 31 * 86400000), aliasOf: 'alice_new' })
    const bob = clientFor('bob')
    const claim = (name) => {
      const b = writeBatch(bob)
      b.set(doc(bob, 'usernames', name), { uid: 'bob', createdAt: serverTimestamp() })
      b.update(doc(bob, 'users', 'bob'), { username: name })
      return b.commit()
    }
    await denied(claim('fresh_alias'))
    await expect(claim('old_alias')).resolves.toBeUndefined()
    // the owner can take a recent alias back
    const alice = clientFor('alice')
    const b = writeBatch(alice)
    b.set(doc(alice, 'usernames', 'fresh_alias'), { uid: 'alice', createdAt: serverTimestamp() })
    b.update(doc(alice, 'users', 'alice'), { username: 'fresh_alias' })
    await expect(b.commit()).resolves.toBeUndefined()
  })

  test('legacy email field: no arbitrary edits; may be synced to the caller’s own VERIFIED auth email, or removed', async () => {
    await db.doc('users/carol').set({ email: 'old@example.test' }, { merge: true })
    await denied(updateDoc(doc(clientFor('carol'), 'users', 'carol'), { email: 'someone-else@example.test' }))
    await denied(updateDoc(doc(clientFor('carol', { email: 'new@example.test', email_verified: false }), 'users', 'carol'), { email: 'new@example.test' }))
    await expect(updateDoc(doc(clientFor('carol', { email: 'new@example.test', email_verified: true }), 'users', 'carol'), { email: 'new@example.test' })).resolves.toBeUndefined()
    const { deleteField } = await import('firebase/firestore')
    await expect(updateDoc(doc(clientFor('carol'), 'users', 'carol'), { email: deleteField() })).resolves.toBeUndefined()
  })

  test('profile creation: no unreserved username, no made-up email; the shipped signup + onboarding flow still works', async () => {
    const signupDoc = { uid: '', role: 'student', verifiedCampus: false, verificationMethod: '', verificationStatus: 'not_started', profileCompleted: false, createdAt: serverTimestamp() }
    // A new account can't claim someone else's @handle by writing it at creation…
    const mallory = clientFor('mallory', { email: 'mallory@example.test' })
    await denied(setDoc(doc(mallory, 'users', 'mallory'), { ...signupDoc, uid: 'mallory', username: 'alice' }))
    // …nor an unreserved free one, nor someone else's email.
    await denied(setDoc(doc(mallory, 'users', 'mallory'), { ...signupDoc, uid: 'mallory', username: 'free_name_xyz' }))
    await denied(setDoc(doc(mallory, 'users', 'mallory'), { ...signupDoc, uid: 'mallory', email: 'alice@example.test' }))
    // Shipped signup (production build at HEAD) writes its own Auth email, unverified — allowed.
    const dave = clientFor('dave', { email: 'dave@example.test', email_verified: false })
    await expect(setDoc(doc(dave, 'users', 'dave'), { ...signupDoc, uid: 'dave', email: 'dave@example.test' }, { merge: true })).resolves.toBeUndefined()
    // Current signup writes no email at all — allowed.
    const erin = clientFor('erin', { email: 'erin@example.test' })
    await expect(setDoc(doc(erin, 'users', 'erin'), { ...signupDoc, uid: 'erin' }, { merge: true })).resolves.toBeUndefined()
    // Onboarding: reserve + set username in one transaction-equivalent batch, then the merge save.
    const b = writeBatch(erin)
    b.set(doc(erin, 'usernames', 'erin_codes'), { uid: 'erin', createdAt: serverTimestamp() })
    b.update(doc(erin, 'users', 'erin'), { username: 'erin_codes', usernameReserved: true })
    await expect(b.commit()).resolves.toBeUndefined()
    await expect(setDoc(doc(erin, 'users', 'erin'), { username: 'erin_codes', displayName: 'Erin' }, { merge: true })).resolves.toBeUndefined()
    // Creating with a username reserved in the same batch is fine too.
    const fay = clientFor('fay', { email: 'fay@example.test' })
    const fb = writeBatch(fay)
    fb.set(doc(fay, 'usernames', 'fay_ok'), { uid: 'fay', createdAt: serverTimestamp() })
    fb.set(doc(fay, 'users', 'fay'), { ...signupDoc, uid: 'fay', username: 'fay_ok' })
    await expect(fb.commit()).resolves.toBeUndefined()
  })
})

describe('reports + account-deletion cleanup', () => {
  const report = (uid, over = {}) => ({ reporterUid: uid, targetType: 'app_problem', targetId: 'problem-abc', reason: 'bug', details: 'Board does not load', status: 'pending', createdAt: serverTimestamp(), ...over })

  test('report creation: exact shape only, always pending, bounded text', async () => {
    const alice = clientFor('alice')
    const add = (data) => setDoc(doc(collection(alice, 'reports')), data)
    await expect(add(report('alice'))).resolves.toBeUndefined()
    await expect(add(report('alice', { targetType: 'post', targetId: 'p1', targetOwnerUid: 'bob' }))).resolves.toBeUndefined()
    await denied(add(report('bob')))
    await denied(add(report('alice', { status: 'resolved' })))
    await denied(add(report('alice', { details: 'x'.repeat(501) })))
    await denied(add(report('alice', { priority: 'urgent' })))
    await denied(add(report('alice', { createdAt: new Date(0) })))
    await denied(getDocs(collection(alice, 'reports')))
  })

  test('a deleting user can find and remove their own username aliases and read markers, nobody else’s', async () => {
    await db.doc('usernames/old_gina').set({ uid: 'gina', releasedAt: Timestamp.now(), aliasOf: 'gina_now' })
    await db.doc('usernames/gina_now').set({ uid: 'gina' })
    await db.doc('users/gina/noticeReads/g1').set({ readAt: Timestamp.now() })
    const gina = clientFor('gina')
    const mine = await getDocs(query(collection(gina, 'usernames'), where('uid', '==', 'gina')))
    expect(mine.docs.map((d) => d.id).sort()).toEqual(['gina_now', 'old_gina'])
    await denied(deleteDoc(doc(clientFor('bob'), 'usernames', 'old_gina')))
    for (const d of mine.docs) await expect(deleteDoc(d.ref)).resolves.toBeUndefined()
    await expect(deleteDoc(doc(gina, 'users', 'gina', 'noticeReads', 'g1'))).resolves.toBeUndefined()
  })
})
