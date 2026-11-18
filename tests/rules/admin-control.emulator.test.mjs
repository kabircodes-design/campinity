// Admin Control Center backend — the REAL exported callables (via the
// Functions SDK's `.run()` hook) against the Firestore emulator (demo
// project — never production). Proves: session-gated, exact numbers from
// real seeded data, no email/private fields returned, read-only endpoints
// write nothing, the verification list no longer auto-approves, and the
// new audit entries (report resolution, admin login) are written.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { seedDevice, seedSession, signWith, withProof, deviceInternals } from './adminTestAuth.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const FUNCTIONS = path.resolve(here, '..', '..', 'functions', 'functions')
const require = createRequire(path.join(FUNCTIONS, 'index.js'))
const PORT = process.env.FIRESTORE_EMULATOR_PORT || '8089'
const PROJECT = 'demo-campinity-rules'
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`
process.env.GCLOUD_PROJECT = PROJECT
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT })

const fns = require(path.join(FUNCTIONS, 'index.js'))
const { makeAdminControlHandlers } = require(path.join(FUNCTIONS, 'adminControl.js'))
const admin = require('firebase-admin')
const { HttpsError } = require('firebase-functions/v2/https')
const db = admin.firestore()
const { Timestamp } = admin.firestore

const DAY = 86400000
const NOW = Date.now()
const ago = (ms) => Timestamp.fromMillis(NOW - ms)
let SESSION
let DEV
// Every call is device-signed, exactly like the admin app (API v2).
const call = (name, data = {}, auth = { uid: 'admin-uid' }) => fns[name].run({ data: withProof({ sessionToken: SESSION, ...data }, DEV.privateKey), auth, rawRequest: { headers: {} } })

async function countAll() {
  const cols = ['users', 'posts', 'communities', 'products', 'lostFound', 'reports', 'moderationActions', 'verificationRequests', 'collegeRequests']
  const counts = await Promise.all(cols.map(async (c) => (await db.collection(c).count().get()).data().count))
  const subs = (await db.collectionGroup('achievementSubmissions').count().get()).data().count
  return [...counts, subs].join(',')
}

beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  DEV = await seedDevice(db, Timestamp, { uid: 'admin-uid' })
  SESSION = await seedSession(db, Timestamp, { uid: 'admin-uid', deviceId: DEV.deviceId })
  await db.doc('colleges/c1').set({ name: 'Test College' })
  const users = [
    ['u-new', { displayName: 'Asha New', displayNameLower: 'asha new', username: 'asha', collegeId: 'c1', email: 'asha@example.test', createdAt: ago(2 * 3600_000), lastActiveAt: ago(60_000), verifiedCampus: false }],
    ['u-week', { displayName: 'Bilal Week', displayNameLower: 'bilal week', username: 'bilal', collegeId: 'c1', email: 'bilal@example.test', createdAt: ago(3 * DAY), lastActiveAt: ago(2 * DAY), verifiedCampus: true }],
    ['u-old', { displayName: 'Chen Old', displayNameLower: 'chen old', username: 'chen', email: 'chen@example.test', createdAt: ago(40 * DAY), verifiedCampus: true, moderationStatus: 'suspended' }],
    ['u-hidden', { displayName: 'Dana Hidden', displayNameLower: 'dana hidden', username: 'dana', collegeId: 'c1', email: 'dana@example.test', createdAt: ago(10 * DAY), lastActiveAt: null, activityStatusVisible: false }]
  ]
  for (const [id, d] of users) await db.doc(`users/${id}`).set(d)
  await db.doc('posts/p1').set({ userId: 'u-week', displayName: 'Bilal Week', text: 'Hello campus', visibility: 'public', createdAt: ago(3600_000) })
  await db.doc('posts/p2').set({ userId: 'u-week', displayName: 'Bilal Week', text: 'Older post', visibility: 'public', createdAt: ago(5 * DAY) })
  await db.doc('communities/k1').set({ name: 'Robotics', type: 'official_club', ownerId: 'u-week', createdBy: 'u-week', privacy: 'public', createdAt: ago(2 * DAY) })
  await db.doc('communities/k2').set({ name: 'Chess', type: 'society', ownerId: 'u-new', createdBy: 'u-new', privacy: 'private', createdAt: ago(1 * DAY) })
  await db.doc('products/m1').set({ name: 'Calculator', price: 500, sellerId: 'u-new', sellerName: 'Asha New', createdAt: ago(6 * 3600_000) })
  await db.doc('lostFound/l1').set({ title: 'Keys', status: 'active', createdBy: 'u-new', createdAt: ago(DAY) })
  for (let i = 0; i < 10; i++) {
    await db.doc(`reports/r${i}`).set({ reporterUid: 'u-new', targetType: 'post', targetId: 'p1', targetOwnerUid: 'u-week', reason: i === 0 ? 'spam' : 'harassment', details: 'x', status: 'pending', createdAt: ago((i + 1) * 3600_000) })
  }
  await db.doc('moderationActions/a1').set({ adminUid: 'admin-uid', action: 'restricted', targetType: 'user', targetId: 'u-week', targetUid: 'u-week', createdAt: ago(4 * DAY) })
  await db.doc('verificationRequests/v-stale').set({ uid: 'u-week', status: 'pending', documentPath: 'x', createdAt: ago(5 * DAY) })
  await db.doc('verificationRequests/v-real').set({ uid: 'u-new', collegeId: 'c1', status: 'pending', documentPath: 'y', createdAt: ago(3600_000) })
  await db.doc('users/u-new/achievementSubmissions/s1').set({ status: 'pending', submittedAt: ago(3600_000) })
  await db.doc('collegeRequests/cr1').set({ status: 'pending', createdAt: ago(DAY) })
  await db.doc('chats/ch1/messages/m1').set({ text: 'private message content', createdAt: ago(60_000) })
  await db.doc('chats/ch1/messages/m2').set({ text: 'another private message', createdAt: ago(30_000) })
})

afterAll(async () => {
  await Promise.all(admin.apps.map((a) => a.delete()))
})

const NEW = ['adminGetDashboard', 'adminSearchUsers', 'adminGetUserDetail', 'adminGetReportContext', 'adminGetSystemHealth']

describe('every new endpoint requires an admin session', () => {
  test.each(NEW)('%s without a session', async (name) => {
    await expect(fns[name].run({ data: {}, auth: { uid: 'x' }, rawRequest: { headers: {} } })).rejects.toMatchObject({ code: 'unauthenticated' })
  })
  test.each(NEW)('%s with an unknown session', async (name) => {
    await expect(fns[name].run({ data: { sessionToken: 'b'.repeat(64) }, auth: { uid: 'x' }, rawRequest: { headers: {} } })).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})

describe('adminGetDashboard — real numbers, no writes, no private data', () => {
  let res
  let before
  beforeAll(async () => {
    before = await countAll()
    res = await call('adminGetDashboard')
  })
  test('overview counts match the seeded data exactly', () => {
    expect(res.overview).toMatchObject({
      totalUsers: 4, newUsers24h: 1, newUsers7d: 2, newUsers30d: 3,
      active24h: 1, // u-hidden hid activity status: its lastActiveAt is cleared, as setActivityStatusVisible does
      totalPosts: 2, totalCommunities: 2, totalClubs: 1, totalProducts: 1, activeLostFound: 1,
      totalMessages: 2,
      pendingReports: 10, pendingVerifications: 2, pendingAchievements: 1, pendingCollegeRequests: 1,
      suspendedUsers: 1
    })
  })
  test('30 daily buckets per trend; today/yesterday totals match', () => {
    for (const key of ['users', 'posts', 'communities', 'products']) expect(res.trends[key]).toHaveLength(30)
    const sum = (k) => res.trends[k].reduce((s, b) => s + b.count, 0)
    expect(sum('users')).toBe(3) // u-new, u-week, u-hidden (u-old is 40 days old)
    expect(sum('posts')).toBe(2)
    expect(sum('communities')).toBe(2)
    expect(sum('products')).toBe(1)
  })
  test('activity feed is newest-first, real events only, and never contains email or message content', () => {
    const times = res.feed.map((e) => e.atMs)
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    expect(res.feed.some((e) => e.type === 'user_registered' && e.userId === 'u-new')).toBe(true)
    expect(res.feed.some((e) => e.type === 'report_submitted')).toBe(true)
    const json = JSON.stringify(res)
    expect(json).not.toMatch(/@example\.test|private message/)
  })
  test('alerts reflect the real backlog (10 pending reports)', () => {
    expect(res.alerts.find((a) => a.key === 'reports-backlog')).toMatchObject({ level: 'warning' })
    expect(res.alerts.find((a) => a.key === 'verification-age')).toBeTruthy() // v-stale is 5 days old
  })
  test('wrote nothing', async () => {
    expect(await countAll()).toBe(before)
  })
})

describe('adminSearchUsers', () => {
  test('finds by name prefix, username and uid; filters work; no email; hidden activity stays hidden', async () => {
    const byName = await call('adminSearchUsers', { query: 'asha' })
    expect(byName.users.map((u) => u.uid)).toEqual(['u-new'])
    const byUsername = await call('adminSearchUsers', { query: '@bilal' })
    expect(byUsername.users.map((u) => u.uid)).toContain('u-week')
    const byUid = await call('adminSearchUsers', { query: 'u-hidden' })
    expect(byUid.mode).toBe('search')
    const browse = await call('adminSearchUsers', { collegeId: 'c1' })
    expect(browse.users.map((u) => u.uid).sort()).toEqual(['u-hidden', 'u-new', 'u-week'])
    expect(browse.users.find((u) => u.uid === 'u-new').collegeName).toBe('Test College')
    const suspended = await call('adminSearchUsers', { moderationStatus: 'suspended' })
    expect(suspended.users.map((u) => u.uid)).toEqual(['u-old'])
    const verified = await call('adminSearchUsers', { verified: true })
    expect(verified.users.map((u) => u.uid).sort()).toEqual(['u-old', 'u-week'])
    const all = await call('adminSearchUsers', {})
    expect(JSON.stringify(all)).not.toMatch(/@example\.test|"email"/)
    expect(all.users.find((u) => u.uid === 'u-hidden')).toMatchObject({ lastActiveAtMs: null, activityHidden: true })
  })
})

describe('adminGetUserDetail', () => {
  test('profile, stats, reports against, moderation history — no email', async () => {
    const before = await countAll()
    const res = await call('adminGetUserDetail', { uid: 'u-week' })
    expect(res.user).toMatchObject({ uid: 'u-week', displayName: 'Bilal Week', collegeName: 'Test College', verifiedCampus: true })
    expect(res.stats).toMatchObject({ posts: 2, communitiesOwned: 1, reportsAgainst: 10 })
    expect(res.reportsAgainst).toHaveLength(10)
    expect(res.moderationHistory.map((a) => a.action)).toContain('restricted')
    expect(res.recentPosts.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(JSON.stringify(res)).not.toMatch(/@example\.test|"email"/)
    expect(await countAll()).toBe(before)
  })
  test('unknown user is not-found; missing uid is invalid', async () => {
    await expect(call('adminGetUserDetail', { uid: 'nope' })).rejects.toMatchObject({ code: 'not-found' })
    await expect(call('adminGetUserDetail', {})).rejects.toMatchObject({ code: 'invalid-argument' })
  })
})

describe('adminGetReportContext', () => {
  test('content, reporter identity only, prior reports on the same target and owner', async () => {
    const before = await countAll()
    const res = await call('adminGetReportContext', { reportId: 'r0' })
    expect(res.report).toMatchObject({ id: 'r0', reason: 'spam', status: 'pending' })
    expect(res.target).toMatchObject({ type: 'post', exists: true, text: 'Hello campus', authorUid: 'u-week' })
    expect(res.reporter).toEqual({ uid: 'u-new', displayName: 'Asha New', username: 'asha' })
    expect(res.owner.uid).toBe('u-week')
    expect(res.sameTargetReports).toHaveLength(9)
    expect(res.sameOwnerReports).toHaveLength(9)
    expect(JSON.stringify(res)).not.toMatch(/@example\.test|"email"/)
    expect(await countAll()).toBe(before)
  })
})

describe('adminListVerificationRequests no longer auto-approves', () => {
  test('stale request is flagged, not approved; nothing is written', async () => {
    const before = await countAll()
    const auditBefore = (await db.collection('moderationActions').count().get()).data().count
    const res = await call('adminListVerificationRequests')
    const stale = res.requests.find((r) => r.id === 'v-stale')
    expect(stale).toMatchObject({ alreadyVerified: true })
    expect(res.requests.find((r) => r.id === 'v-real')).toMatchObject({ alreadyVerified: false })
    expect((await db.doc('verificationRequests/v-stale').get()).data().status).toBe('pending')
    expect((await db.collection('moderationActions').count().get()).data().count).toBe(auditBefore)
    expect(await countAll()).toBe(before)
  })
})

describe('new audit entries', () => {
  test('resolving a report writes a server-side audit entry', async () => {
    await call('adminResolveReport', { reportId: 'r9', status: 'dismissed' })
    const snap = await db.collection('moderationActions').where('targetId', '==', 'r9').get()
    expect(snap.docs.map((d) => d.data().action)).toEqual(['report_dismissed'])
    expect(snap.docs[0].data()).toMatchObject({ adminUid: 'admin-uid', targetType: 'report', targetUid: 'u-week', viaAdminSession: true })
  })
  test('admin login attempts are audited (success and failure), never the password', async () => {
    const crypto = await import('node:crypto')
    const salt = 's'.repeat(32)
    await db.doc('adminSession/config').set({ salt, hash: crypto.scryptSync('right-password', salt, 64).toString('hex') })
    const run = (fn, data) => fns[fn].run({ data, auth: { uid: 'admin-uid' }, rawRequest: { headers: {} } })
    await run('adminLogin', { password: 'wrong', deviceId: DEV.deviceId })
    const start = await run('adminLogin', { password: 'right-password', deviceId: DEV.deviceId })
    await run('adminLoginFinish', { challengeId: start.challengeId, signature: signWith(DEV.privateKey, deviceInternals.messages.login(start.challengeId, start.nonce, DEV.deviceId)) })
    const snap = await db.collection('moderationActions').where('targetType', '==', 'adminSession').get()
    expect(snap.docs.map((d) => d.data().action).sort()).toEqual(['admin_login', 'admin_login_failed'])
    expect(JSON.stringify(snap.docs.map((d) => d.data()))).not.toMatch(/right-password|wrong/)
  })
})

describe('adminGetSystemHealth (Cloud Logging simulated — the real API is not reachable from the emulator)', () => {
  const fakeAdmin = (projectId = PROJECT) => ({
    firestore: admin.firestore,
    app: () => ({ options: { projectId, credential: { getAccessToken: async () => ({ access_token: 't' }) } } })
  })
  const requireValidAdminSession = async (t) => {
    if (t !== SESSION) throw new HttpsError('unauthenticated', 'x')
  }
  test('aggregates real request/error entries per function; redacts bearer tokens', async () => {
    const fetchImpl = async (url, init) => {
      const body = JSON.parse(init.body)
      const isErrors = body.filter.includes('severity>=ERROR')
      const entries = isErrors
        ? [{ resource: { labels: { service_name: 'adminlogin' } }, timestamp: new Date(NOW).toISOString(), textPayload: 'boom Bearer abc.def' }]
        : [
            { resource: { labels: { service_name: 'adminlogin' } }, httpRequest: { status: 200, latency: '0.120s' } },
            { resource: { labels: { service_name: 'adminlogin' } }, httpRequest: { status: 500, latency: '1.500s' } },
            { resource: { labels: { service_name: 'radarnearby' } }, httpRequest: { status: 401, latency: '0.050s' } }
          ]
      return { ok: true, json: async () => ({ entries }) }
    }
    const h = makeAdminControlHandlers({ db: () => db, admin: fakeAdmin(), requireValidAdminSession, HttpsError, fetchImpl })
    const res = await h.getSystemHealth({ data: { sessionToken: SESSION } })
    expect(res.available).toBe(true)
    expect(res.totals).toEqual({ requests: 3, serverErrors: 1, clientErrors: 1, errorLogs: 1 })
    const login = res.functions.find((f) => f.name === 'adminlogin')
    expect(login).toMatchObject({ requests: 2, serverErrors: 1, errorLogs: 1 })
    expect(login.lastError.message).toBe('boom Bearer [redacted]')
  })
  test('no log access -> available:false with the reason (never "healthy")', async () => {
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({}) })
    const h = makeAdminControlHandlers({ db: () => db, admin: fakeAdmin(), requireValidAdminSession, HttpsError, fetchImpl })
    const res = await h.getSystemHealth({ data: { sessionToken: SESSION } })
    expect(res).toEqual({ available: false, reason: expect.stringMatching(/logging\.viewer/) })
  })
})

describe('list pagination + names (adminListReports, adminListAuditLog)', () => {
  test('reports: cursor pages are disjoint and newest-first; names shown, never email; read-only', async () => {
    const before = await countAll()
    const p1 = await call('adminListReports', { status: 'pending', pageSize: 4 })
    expect(p1.reports).toHaveLength(4)
    expect(p1.nextCursor).toBe(p1.reports[3].id)
    expect(p1.reports[0].reporter).toEqual({ displayName: 'Asha New', username: 'asha' })
    expect(p1.reports[0].targetOwner).toEqual({ displayName: 'Bilal Week', username: 'bilal' })
    expect(JSON.stringify(p1)).not.toMatch(/@example\.test|email/)
    const p2 = await call('adminListReports', { status: 'pending', pageSize: 4, cursor: p1.nextCursor })
    expect(p2.reports.length).toBeGreaterThan(0)
    const ids1 = new Set(p1.reports.map((r) => r.id))
    expect(p2.reports.some((r) => ids1.has(r.id))).toBe(false)
    const ms = (r) => r.createdAt.toMillis?.() ?? r.createdAt._seconds * 1000
    expect(ms(p1.reports[3])).toBeGreaterThanOrEqual(ms(p2.reports[0]))
    expect(await countAll()).toBe(before)
  })
  test('reports: last page has no cursor; unknown cursor falls back to the first page', async () => {
    const all = await call('adminListReports', { status: 'pending', pageSize: 100 })
    expect(all.nextCursor).toBeNull()
    const bogus = await call('adminListReports', { status: 'pending', pageSize: 2, cursor: 'does-not-exist' })
    expect(bogus.reports.map((r) => r.id)).toEqual(all.reports.slice(0, 2).map((r) => r.id))
  })
  test('audit log: cursor pagination, newest first', async () => {
    const p1 = await call('adminListAuditLog', { pageSize: 1 })
    expect(p1.entries).toHaveLength(1)
    expect(p1.nextCursor).toBe(p1.entries[0].id)
    const p2 = await call('adminListAuditLog', { pageSize: 1, cursor: p1.nextCursor })
    expect(p2.entries).toHaveLength(1)
    expect(p2.entries[0].id).not.toBe(p1.entries[0].id)
  })
  test('both still require a session', async () => {
    for (const name of ['adminListReports', 'adminListAuditLog']) {
      await expect(fns[name].run({ data: { cursor: 'x' }, auth: { uid: 'x' }, rawRequest: { headers: {} } })).rejects.toMatchObject({ code: 'unauthenticated' })
    }
  })
})
