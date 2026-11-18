// Batch A readiness: runs the REAL exported admin callables from
// functions/functions/index.js (via the Functions SDK's own `.run()` test
// hook) against the local Firestore emulator (demo project — never
// production). Run under the runtime being evaluated (Node 22).
//
// Covers: the admin login path (scrypt hash verification + session issue),
// the session gate on every session-protected admin function, session
// expiry, and representative read/write admin operations end to end.
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
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
const admin = require('firebase-admin')
const db = admin.firestore()
const { Timestamp } = admin.firestore

const PASSWORD = 'batch-a-test-password'
const ADMIN_UID = 'admin-tester'
const call = (name, data, auth = { uid: ADMIN_UID }) => fns[name].run({ data, auth, rawRequest: { headers: {} } })

// The 26 existing admin functions of Batch A (explicit — newer admin* read
// endpoints such as adminGetDashboard are not part of this batch).
const BATCH_A = [
  'adminDeleteAnnouncement', 'adminGetOverviewCounts', 'adminGetVerificationDocumentUrl', 'adminListAchievementSubmissions',
  'adminListAuditLog', 'adminListCollegeRequests', 'adminListCommunities', 'adminListCommunityMembers', 'adminListLostFound',
  'adminListMarketplaceProducts', 'adminListReports', 'adminListVerificationRequests', 'adminLogin', 'adminLogout',
  'adminModerateCommunityMember', 'adminModerateContent', 'adminModerateLostFoundItem', 'adminModerateProduct',
  'adminResolveReport', 'adminReviewAchievementSubmission', 'adminReviewCollegeRequest', 'adminReviewVerificationRequest',
  'adminSendNotification', 'adminSetAnnouncementPinned', 'adminSetUserModerationStatus', 'adminSetUserVerification'
].filter((n) => typeof fns[n] === 'function' || typeof fns[n] === 'object')
const SESSION_GATED = BATCH_A.filter((n) => n !== 'adminLogin' && n !== 'adminLogout')

let session
let dev
const callS = (name, data = {}, token = session) => call(name, withProof({ sessionToken: token, ...data }, dev.privateKey))
beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  // Same scheme as setAdminPassword (scrypt, 64 bytes, hex) — the hash format production stores.
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(PASSWORD, salt, 64).toString('hex')
  await db.doc('adminSession/config').set({ hash, salt })
  await db.doc('reports/r1').set({ status: 'pending', targetType: 'post', targetId: 'p1', reason: 'spam', createdAt: Timestamp.now() })
  dev = await seedDevice(db, Timestamp, { uid: ADMIN_UID })
})

afterAll(async () => {
  await Promise.all(admin.apps.map((a) => a.delete()))
})

describe(`Batch A on ${process.version}: exported set`, () => {
  test('exactly the 26 admin functions', () => {
    expect(BATCH_A).toHaveLength(26)
  })
})

describe('admin login (device-bound: enrolled device + password + signed challenge)', () => {
  test('requires a signed-in Firebase user', async () => {
    // null, not undefined: undefined would trigger call()'s default signed-in auth.
    await expect(call('adminLogin', { password: PASSWORD, deviceId: dev.deviceId }, null)).rejects.toMatchObject({ code: 'unauthenticated' })
  })
  test('wrong password on the enrolled device is refused without a session', async () => {
    await expect(call('adminLogin', { password: 'nope', deviceId: dev.deviceId })).resolves.toEqual({ ok: false })
  })
  test('correct password from an UNENROLLED device is refused', async () => {
    await expect(call('adminLogin', { password: PASSWORD })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(call('adminLogin', { password: PASSWORD, deviceId: 'a'.repeat(32) })).rejects.toMatchObject({ code: 'permission-denied' })
  })
  test('correct password + signed challenge issues a stored (hashed), expiring, device-bound session', async () => {
    const start = await call('adminLogin', { password: PASSWORD, deviceId: dev.deviceId })
    expect(start).toMatchObject({ ok: true, challengeId: expect.any(String), nonce: expect.any(String) })
    expect(start.sessionToken).toBeUndefined()
    const signature = signWith(dev.privateKey, deviceInternals.messages.login(start.challengeId, start.nonce, dev.deviceId))
    const res = await call('adminLoginFinish', { challengeId: start.challengeId, signature })
    expect(res.ok).toBe(true)
    expect(res.sessionToken).toMatch(/^[0-9a-f]{64}$/)
    session = res.sessionToken
    expect((await db.doc(`adminSession/tokens/items/${session}`).get()).exists).toBe(false) // never stored raw
    const doc = await db.doc(`adminSession/tokens/items/${deviceInternals.sha256hex(session)}`).get()
    expect(doc.data()).toMatchObject({ createdByUid: ADMIN_UID, deviceId: dev.deviceId })
    expect(doc.data().expiresAt.toMillis()).toBeGreaterThan(Date.now())
  })
})

describe('session gate on every session-protected admin function', () => {
  test.each(SESSION_GATED)('%s refuses a call without a session', async (name) => {
    await expect(call(name, {})).rejects.toMatchObject({ code: 'unauthenticated' })
  })
  test.each(SESSION_GATED)('%s refuses an unknown session token (even with a valid device proof)', async (name) => {
    await expect(callS(name, {}, 'f'.repeat(64))).rejects.toMatchObject({ code: 'unauthenticated' })
  })
  test.each(SESSION_GATED)('%s refuses a valid session WITHOUT a device proof (stolen token)', async (name) => {
    await expect(call(name, { sessionToken: session })).rejects.toMatchObject({ code: 'unauthenticated' })
  })
  test('an expired session is refused and removed', async () => {
    const stale = await seedSession(db, Timestamp, { uid: ADMIN_UID, deviceId: dev.deviceId, expiresInMs: -1000 })
    await expect(callS('adminListReports', {}, stale)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect((await db.doc(`adminSession/tokens/items/${deviceInternals.sha256hex(stale)}`).get()).exists).toBe(false)
  })
})

describe('representative admin operations with a valid session', () => {
  test('adminGetOverviewCounts returns numeric counts (count aggregation)', async () => {
    const res = await callS('adminGetOverviewCounts')
    expect(res).toMatchObject({ reports: 1 })
    for (const v of Object.values(res)) expect(typeof v).toBe('number')
  })
  test('adminListReports lists the pending report', async () => {
    const res = await callS('adminListReports', { status: 'pending' })
    expect(JSON.stringify(res)).toContain('r1')
  })
  test('adminResolveReport updates the report; a second resolve is refused', async () => {
    await expect(callS('adminResolveReport', { reportId: 'r1', status: 'dismissed' })).resolves.toEqual({ ok: true })
    expect((await db.doc('reports/r1').get()).data().status).toBe('dismissed')
    await expect(callS('adminResolveReport', { reportId: 'r1', status: 'resolved' })).rejects.toMatchObject({ code: 'failed-precondition' })
  })
  test('adminListAuditLog reads the audit log', async () => {
    const res = await callS('adminListAuditLog')
    expect(Array.isArray(res.entries)).toBe(true)
  })
  test('adminLogout deletes the session; it is then refused', async () => {
    await expect(call('adminLogout', { sessionToken: session })).resolves.toEqual({ ok: true })
    expect((await db.doc(`adminSession/tokens/items/${deviceInternals.sha256hex(session)}`).get()).exists).toBe(false)
    await expect(callS('adminListReports')).rejects.toMatchObject({ code: 'unauthenticated' })
  })
})
