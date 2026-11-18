// Device-bound admin authorization — the REAL exported callables against
// the Firestore emulator (demo project, never production), plus the owner
// script run as a child process against the same emulator.
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { newDeviceKey, seedDevice, seedSession, signWith, withProof, deviceInternals } from './adminTestAuth.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(here, '..', '..')
const FUNCTIONS = path.join(ROOT, 'functions', 'functions')
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
const { messages, sha256hex } = deviceInternals

const PASSWORD = 'device-auth-test-password'
const OWNER = 'owner-uid'
const run = (name, data, uid = OWNER) => fns[name].run({ data, auth: uid ? { uid } : null, rawRequest: { headers: {} } })
const ownerScript = (...args) =>
  execFileSync(process.execPath, [path.join(ROOT, 'functions', 'scripts', 'admin-device-owner.cjs'), ...args, `--project=${PROJECT}`, `--emulator=127.0.0.1:${PORT}`], { encoding: 'utf8' })
const codeFrom = (out) => out.match(/\b[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}\b/)[0]
const audits = async (action) => (await db.collection('moderationActions').where('action', '==', action).get()).docs.map((d) => d.data())

async function enroll({ code, key = newDeviceKey(), uid = OWNER, dsa = 'der', platform = 'android' }) {
  const start = await run('adminEnrollDeviceStart', { password: PASSWORD, enrollmentCode: code, publicKey: key.publicKeySpki, label: 'Pixel', platform }, uid)
  if (!start.ok) return { start }
  const fin = await run('adminEnrollDeviceFinish', { challengeId: start.challengeId, signature: signWith(key.privateKey, messages.enroll(start.challengeId, start.nonce), dsa) }, uid)
  return { start, fin, key }
}
async function login(dev, uid = OWNER) {
  const start = await run('adminLogin', { password: PASSWORD, deviceId: dev.deviceId }, uid)
  return run('adminLoginFinish', { challengeId: start.challengeId, signature: signWith(dev.privateKey, messages.login(start.challengeId, start.nonce, dev.deviceId)) }, uid)
}
const signedCall = (name, token, key, data = {}, opts) => run(name, withProof({ sessionToken: token, ...data }, key, opts))

beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  const salt = crypto.randomBytes(16).toString('hex')
  await db.doc('adminSession/config').set({ salt, hash: crypto.scryptSync(PASSWORD, salt, 64).toString('hex') })
})
beforeEach(async () => {
  // rate-limit state is per test
  const a = await db.collection('adminAuthAttempts').get()
  await Promise.all(a.docs.map((d) => d.ref.delete()))
})
afterAll(async () => {
  await Promise.all(admin.apps.map((a) => a.delete()))
})

describe('capabilities', () => {
  test('public, non-sensitive version probe (lets clients refuse an old backend)', async () => {
    expect(await run('adminGetCapabilities', {}, null)).toMatchObject({ apiVersion: 2, deviceAuth: true, verificationListReadOnly: true })
  })
})

describe('enrollment (owner script code + Firebase sign-in + password + proof of key possession)', () => {
  test('owner script refuses to write without --confirm', () => {
    expect(() => execFileSync(process.execPath, [path.join(ROOT, 'functions', 'scripts', 'admin-device-owner.cjs'), 'create-code', `--project=${PROJECT}`, `--emulator=127.0.0.1:${PORT}`], { stdio: 'pipe' })).toThrow()
  })

  test('full first-device enrollment via owner-script code; code is single use; session works', async () => {
    const code = codeFrom(ownerScript('create-code', `--uid=${OWNER}`, `--confirm=${PROJECT}`))
    const stored = await db.collection('adminEnrollmentCodes').get()
    expect(stored.docs.some((d) => d.id === sha256hex(code.replace(/-/g, '')))).toBe(true)
    expect(JSON.stringify(stored.docs.map((d) => d.data()))).not.toContain(code) // hashed only
    const { fin, key } = await enroll({ code })
    expect(fin).toMatchObject({ ok: true, deviceId: expect.stringMatching(/^[a-f0-9]{32}$/), sessionToken: expect.any(String) })
    const device = (await db.doc(`adminDevices/${fin.deviceId}`).get()).data()
    expect(device).toMatchObject({ ownerUid: OWNER, status: 'active', platform: 'android', enrolledVia: 'owner_script' })
    await expect(signedCall('adminListDevices', fin.sessionToken, key.privateKey)).resolves.toMatchObject({ devices: [expect.objectContaining({ id: fin.deviceId, isCurrent: true })] })
    // reuse of the same code
    await expect(enroll({ code })).rejects.toMatchObject({ code: 'permission-denied' })
    expect(await audits('admin_device_enrolled')).toHaveLength(1)
  })

  test('invalid code is refused BEFORE the password is checked (no password oracle)', async () => {
    const key = newDeviceKey()
    const res = run('adminEnrollDeviceStart', { password: 'wrong', enrollmentCode: 'AAAA-BBBB-CCCC', publicKey: key.publicKeySpki, platform: 'android' })
    await expect(res).rejects.toMatchObject({ code: 'permission-denied' })
  })

  test('code bound to the owner cannot be redeemed by another Firebase account', async () => {
    const code = codeFrom(ownerScript('create-code', `--uid=${OWNER}`, `--confirm=${PROJECT}`))
    await expect(enroll({ code, uid: 'someone-else' })).rejects.toMatchObject({ code: 'permission-denied' })
  })

  test('wrong password with a valid code: refused; 3 wrong passwords void the code', async () => {
    const code = codeFrom(ownerScript('create-code', `--uid=${OWNER}`, `--confirm=${PROJECT}`))
    const key = newDeviceKey()
    for (let i = 0; i < 3; i++) {
      await expect(run('adminEnrollDeviceStart', { password: 'wrong', enrollmentCode: code, publicKey: key.publicKeySpki, platform: 'android' })).resolves.toEqual({ ok: false })
    }
    await expect(enroll({ code })).rejects.toMatchObject({ code: 'permission-denied' })
  })

  test('signature from a different key than the one being enrolled is refused; code survives for a retry', async () => {
    const code = codeFrom(ownerScript('create-code', `--uid=${OWNER}`, `--confirm=${PROJECT}`))
    const key = newDeviceKey()
    const other = newDeviceKey()
    const start = await run('adminEnrollDeviceStart', { password: PASSWORD, enrollmentCode: code, publicKey: key.publicKeySpki, platform: 'android' })
    await expect(run('adminEnrollDeviceFinish', { challengeId: start.challengeId, signature: signWith(other.privateKey, messages.enroll(start.challengeId, start.nonce)) })).rejects.toMatchObject({ code: 'permission-denied' })
    // challenge is burned
    await expect(run('adminEnrollDeviceFinish', { challengeId: start.challengeId, signature: signWith(key.privateKey, messages.enroll(start.challengeId, start.nonce)) })).rejects.toMatchObject({ code: 'permission-denied' })
    // but the owner's code still works for a clean retry (WebCrypto signature encoding)
    const { fin } = await enroll({ code, key, dsa: 'ieee-p1363', platform: 'web' })
    expect(fin.ok).toBe(true)
  })

  test('rejects non-P-256 keys and duplicate keys', async () => {
    const code = codeFrom(ownerScript('create-code', `--uid=${OWNER}`, `--confirm=${PROJECT}`))
    const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
    const p384 = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
    for (const publicKey of [rsa, p384, 'not-a-key']) {
      await expect(run('adminEnrollDeviceStart', { password: PASSWORD, enrollmentCode: code, publicKey, platform: 'android' })).rejects.toMatchObject({ code: 'invalid-argument' })
    }
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    await expect(run('adminEnrollDeviceStart', { password: PASSWORD, enrollmentCode: code, publicKey: dev.publicKeySpki, platform: 'android' })).rejects.toMatchObject({ code: 'already-exists' })
  })

  test('an enrolled device can approve another device (in-app code), bound to the same owner', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    const token = await seedSession(db, Timestamp, { uid: OWNER, deviceId: dev.deviceId })
    const { code, expiresAtMs } = await signedCall('adminCreateEnrollmentCode', token, dev.privateKey)
    expect(expiresAtMs - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000)
    await expect(enroll({ code, uid: 'intruder' })).rejects.toMatchObject({ code: 'permission-denied' })
    const { fin } = await enroll({ code })
    expect((await db.doc(`adminDevices/${fin.deviceId}`).get()).data()).toMatchObject({ enrolledVia: 'device', approvedByDeviceId: dev.deviceId })
  })
})

describe('login', () => {
  test('correct password from an unenrolled / revoked / other-owner device is denied and audited', async () => {
    const revoked = await seedDevice(db, Timestamp, { uid: OWNER, status: 'revoked' })
    const foreign = await seedDevice(db, Timestamp, { uid: 'other-owner' })
    for (const deviceId of [undefined, 'f'.repeat(32), revoked.deviceId, foreign.deviceId]) {
      await expect(run('adminLogin', { password: PASSWORD, deviceId })).rejects.toMatchObject({ code: 'permission-denied' })
    }
    expect((await audits('admin_login_unauthorized_device')).length).toBeGreaterThanOrEqual(4)
  })

  test('challenge is single use (replay refused) and expires', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    const start = await run('adminLogin', { password: PASSWORD, deviceId: dev.deviceId })
    const signature = signWith(dev.privateKey, messages.login(start.challengeId, start.nonce, dev.deviceId))
    await expect(run('adminLoginFinish', { challengeId: start.challengeId, signature })).resolves.toMatchObject({ ok: true })
    await expect(run('adminLoginFinish', { challengeId: start.challengeId, signature })).rejects.toMatchObject({ code: 'permission-denied' })

    const s2 = await run('adminLogin', { password: PASSWORD, deviceId: dev.deviceId })
    await db.doc(`adminAuthChallenges/${s2.challengeId}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    await expect(run('adminLoginFinish', { challengeId: s2.challengeId, signature: signWith(dev.privateKey, messages.login(s2.challengeId, s2.nonce, dev.deviceId)) })).rejects.toMatchObject({ code: 'deadline-exceeded' })
  })

  test('a copied APK on another phone (different key) cannot finish login even with the right password and deviceId', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    const attacker = newDeviceKey()
    const start = await run('adminLogin', { password: PASSWORD, deviceId: dev.deviceId })
    await expect(run('adminLoginFinish', { challengeId: start.challengeId, signature: signWith(attacker.privateKey, messages.login(start.challengeId, start.nonce, dev.deviceId)) })).rejects.toMatchObject({ code: 'permission-denied' })
  })

  test('another Firebase account cannot finish the owner’s challenge', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    const start = await run('adminLogin', { password: PASSWORD, deviceId: dev.deviceId })
    await expect(run('adminLoginFinish', { challengeId: start.challengeId, signature: signWith(dev.privateKey, messages.login(start.challengeId, start.nonce, dev.deviceId)) }, 'intruder')).rejects.toMatchObject({ code: 'permission-denied' })
  })

  test('rate limit: 5 failures lock the account for 15 minutes, even for correct credentials', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    for (let i = 0; i < 5; i++) await run('adminLogin', { password: 'wrong', deviceId: dev.deviceId })
    await expect(run('adminLogin', { password: PASSWORD, deviceId: dev.deviceId })).rejects.toMatchObject({ code: 'resource-exhausted' })
    await db.doc(`adminAuthAttempts/${OWNER}`).update({ lockedUntil: Timestamp.fromMillis(Date.now() - 1) })
    await expect(login(dev)).resolves.toMatchObject({ ok: true })
    expect((await db.doc(`adminAuthAttempts/${OWNER}`).get()).exists).toBe(false) // cleared on success
  })
})

describe('every admin call is device-signed', () => {
  let dev
  let token
  beforeAll(async () => {
    dev = await seedDevice(db, Timestamp, { uid: OWNER })
    token = (await login(dev)).sessionToken
  })

  test('valid proofs work (DER and raw encodings); no proof is refused', async () => {
    await expect(signedCall('adminListDevices', token, dev.privateKey)).resolves.toHaveProperty('devices')
    await expect(signedCall('adminListDevices', token, dev.privateKey, {}, { dsa: 'ieee-p1363' })).resolves.toHaveProperty('devices')
    await expect(run('adminListDevices', { sessionToken: token })).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  test('replayed proof (same nonce) is refused', async () => {
    const data = withProof({ sessionToken: token }, dev.privateKey)
    await expect(run('adminListDevices', data)).resolves.toHaveProperty('devices')
    await expect(run('adminListDevices', data)).rejects.toMatchObject({ code: 'unauthenticated', message: expect.stringMatching(/already used/) })
  })

  test('stale timestamp, tampered body, or another key is refused', async () => {
    await expect(signedCall('adminListDevices', token, dev.privateKey, {}, { ts: Date.now() - 5 * 60 * 1000 })).rejects.toMatchObject({ code: 'unauthenticated' })
    const signed = withProof({ sessionToken: token, status: 'pending' }, dev.privateKey)
    await expect(run('adminListReports', { ...signed, status: 'resolved' })).rejects.toMatchObject({ code: 'unauthenticated', message: expect.stringMatching(/signature/) })
    await expect(signedCall('adminListDevices', token, newDeviceKey().privateKey)).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  test('the session only works for the Firebase account that created it (and not signed out)', async () => {
    const data = () => withProof({ sessionToken: token }, dev.privateKey)
    await expect(run('adminListDevices', data(), 'someone-else')).rejects.toMatchObject({ code: 'unauthenticated', message: expect.stringMatching(/account/) })
    await expect(run('adminListDevices', data(), null)).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(run('adminListDevices', data())).resolves.toHaveProperty('devices')
  })

  test('idle timeout ends the session', async () => {
    const t = await seedSession(db, Timestamp, { uid: OWNER, deviceId: dev.deviceId, idleInMs: -1 })
    await expect(signedCall('adminListDevices', t, dev.privateKey)).rejects.toMatchObject({ code: 'unauthenticated', message: expect.stringMatching(/expired/) })
  })

  test('device list never exposes public keys', async () => {
    const res = await signedCall('adminListDevices', token, dev.privateKey)
    expect(JSON.stringify(res)).not.toContain(dev.publicKeySpki)
  })
})

describe('revocation', () => {
  test('revoking a device ends its sessions immediately; other devices keep working; audited', async () => {
    const phone = await seedDevice(db, Timestamp, { uid: OWNER })
    const laptop = await seedDevice(db, Timestamp, { uid: OWNER, platform: 'web' })
    const phoneToken = (await login(phone)).sessionToken
    const laptopToken = (await login(laptop)).sessionToken
    const res = await signedCall('adminRevokeDevice', laptopToken, laptop.privateKey, { deviceId: phone.deviceId })
    expect(res).toMatchObject({ ok: true, revokedCurrent: false, sessionsEnded: 1 })
    await expect(signedCall('adminListDevices', phoneToken, phone.privateKey)).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(run('adminLogin', { password: PASSWORD, deviceId: phone.deviceId })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(signedCall('adminListDevices', laptopToken, laptop.privateKey)).resolves.toHaveProperty('devices')
    expect((await audits('admin_device_revoked')).some((a) => a.targetId === phone.deviceId)).toBe(true)
  })

  test("cannot revoke another owner's device", async () => {
    const mine = await seedDevice(db, Timestamp, { uid: OWNER })
    const theirs = await seedDevice(db, Timestamp, { uid: 'other-owner' })
    const t = await seedSession(db, Timestamp, { uid: OWNER, deviceId: mine.deviceId })
    await expect(signedCall('adminRevokeDevice', t, mine.privateKey, { deviceId: theirs.deviceId })).rejects.toMatchObject({ code: 'not-found' })
  })

  test('lost phone with no other device: owner script revoke-all', async () => {
    const phone = await seedDevice(db, Timestamp, { uid: OWNER })
    const t = (await login(phone)).sessionToken
    expect(ownerScript('list')).toContain(phone.deviceId)
    ownerScript('revoke', `--device=${phone.deviceId}`, `--confirm=${PROJECT}`)
    await expect(signedCall('adminListDevices', t, phone.privateKey)).rejects.toMatchObject({ code: 'unauthenticated' })
    ownerScript('revoke-all', `--confirm=${PROJECT}`)
    const active = await db.collection('adminDevices').where('status', '==', 'active').get()
    expect(active.size).toBe(0)
  })
})

describe('audit trail never contains secrets', () => {
  test('no password, enrollment code, session token or key material in audit entries', async () => {
    const all = JSON.stringify((await db.collection('moderationActions').get()).docs.map((d) => d.data()))
    expect(all).not.toContain(PASSWORD)
    expect(all).not.toMatch(/[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/)
    expect(all).not.toMatch(/MFkwEwYHKoZIzj0CAQ/) // SPKI prefix of P-256 keys
  })
})
