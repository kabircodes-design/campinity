// Admin password rotation (owner script core + CLI guards) against the
// Firestore emulator (demo project, never production). Verifies the new
// password works through the REAL device-bound login callables and that
// enrolled devices survive the rotation.
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import path from 'node:path'
import { seedDevice, seedSession, signWith, deviceInternals } from './adminTestAuth.mjs'

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
const { messages } = deviceInternals
const { rotateAdminPassword, validateNewPassword } = require(path.join(ROOT, 'functions', 'scripts', 'adminPasswordRotation.cjs'))

const OWNER = 'owner-uid'
const OLD = 'old-admin-password-1'
const NEW = 'brand-new-Admin-pass-42'
const CREATED = Timestamp.fromMillis(Date.UTC(2026, 0, 1))
const run = (name, data, uid = OWNER) => fns[name].run({ data, auth: uid ? { uid } : null, rawRequest: { headers: {} } })
const script = (...args) =>
  spawnSync(process.execPath, [path.join(ROOT, 'functions', 'scripts', 'admin-device-owner.cjs'), ...args], { encoding: 'utf8', input: '' })

async function loginWith(password, dev) {
  const start = await run('adminLogin', { password, deviceId: dev.deviceId })
  if (!start?.challengeId) return start
  return run('adminLoginFinish', { challengeId: start.challengeId, signature: signWith(dev.privateKey, messages.login(start.challengeId, start.nonce, dev.deviceId)) })
}

beforeEach(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  const salt = crypto.randomBytes(16).toString('hex')
  await db.doc('adminSession/config').set({ salt, hash: crypto.scryptSync(OLD, salt, 64).toString('hex'), createdAt: CREATED, createdByUid: OWNER })
})
afterAll(async () => {
  await Promise.all(admin.apps.map((a) => a.delete()))
})

describe('rotateAdminPassword (core)', () => {
  test('rotates in place: new password logs in on the SAME enrolled device, old one is rejected, metadata preserved', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    const deviceBefore = (await db.doc(`adminDevices/${dev.deviceId}`).get()).data()
    await rotateAdminPassword(db, Timestamp, { newPassword: NEW })

    const cfg = (await db.doc('adminSession/config').get()).data()
    expect(cfg.createdByUid).toBe(OWNER)
    expect(cfg.createdAt.toMillis()).toBe(CREATED.toMillis())
    expect(cfg.rotatedAt).toBeTruthy()
    expect(cfg.salt).toMatch(/^[a-f0-9]{32}$/)
    expect(cfg.hash).toBe(crypto.scryptSync(NEW, cfg.salt, 64).toString('hex'))
    expect(JSON.stringify(cfg)).not.toContain(NEW)

    // Devices untouched -> enrollment preserved
    expect((await db.doc(`adminDevices/${dev.deviceId}`).get()).data()).toEqual(deviceBefore)

    const ok = await loginWith(NEW, dev)
    expect(ok).toMatchObject({ ok: true, sessionToken: expect.any(String) })
    const bad = await loginWith(OLD, dev).catch((e) => ({ error: e.message }))
    expect(bad?.ok).not.toBe(true)
  })

  test('refuses when adminSession/config is missing and does NOT create it', async () => {
    await db.doc('adminSession/config').delete()
    await expect(rotateAdminPassword(db, Timestamp, { newPassword: NEW })).rejects.toThrow(/does not exist/)
    expect((await db.doc('adminSession/config').get()).exists).toBe(false)
  })

  test('refuses reusing the current password, short or weak passwords; config unchanged', async () => {
    const before = (await db.doc('adminSession/config').get()).data()
    await expect(rotateAdminPassword(db, Timestamp, { newPassword: OLD })).rejects.toThrow(/same as the current/)
    await expect(rotateAdminPassword(db, Timestamp, { newPassword: 'short' })).rejects.toThrow(/at least 12/)
    await expect(rotateAdminPassword(db, Timestamp, { newPassword: 'aaaaaaaaaaaaaaaa' })).rejects.toThrow(/repetitive/)
    await expect(rotateAdminPassword(db, Timestamp, { newPassword: ' padded-password ' })).rejects.toThrow(/spaces/)
    expect((await db.doc('adminSession/config').get()).data()).toEqual(before)
    expect(validateNewPassword(NEW)).toBeNull()
  })

  test('without endSessions, existing sessions are kept; with it they end but devices stay active', async () => {
    const dev = await seedDevice(db, Timestamp, { uid: OWNER })
    await seedSession(db, Timestamp, { uid: OWNER, deviceId: dev.deviceId })
    await seedSession(db, Timestamp, { uid: OWNER, deviceId: dev.deviceId })
    const items = () => db.collection('adminSession').doc('tokens').collection('items').get()

    expect(await rotateAdminPassword(db, Timestamp, { newPassword: NEW })).toEqual({ sessionsEnded: 0 })
    expect((await items()).size).toBe(2)

    expect(await rotateAdminPassword(db, Timestamp, { newPassword: NEW + '-2', endSessions: true })).toEqual({ sessionsEnded: 2 })
    expect((await items()).size).toBe(0)
    expect((await db.doc(`adminDevices/${dev.deviceId}`).get()).data().status).toBe('active')
    expect((await db.doc('adminSession/config').get()).exists).toBe(true)
  })

  test('writes an audit entry with no secret material', async () => {
    await rotateAdminPassword(db, Timestamp, { newPassword: NEW, endSessions: true })
    const entries = (await db.collection('moderationActions').where('action', '==', 'admin_password_rotated').get()).docs.map((d) => d.data())
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ viaOwnerScript: true, targetType: 'adminSession', targetId: 'config', sessionsEnded: 0 })
    const cfg = (await db.doc('adminSession/config').get()).data()
    const text = JSON.stringify(entries[0])
    for (const secret of [NEW, OLD, cfg.hash, cfg.salt]) expect(text).not.toContain(secret)
  })
})

describe('rotate-password CLI guards', () => {
  const base = ['rotate-password', `--project=${PROJECT}`, `--emulator=127.0.0.1:${PORT}`]
  test('refuses without --confirm=<project>', () => {
    const r = script(...base)
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/--confirm=/)
  })
  test('refuses a password passed as an argument, without echoing it', () => {
    const r = script(...base, `--confirm=${PROJECT}`, `--password=${NEW}`)
    expect(r.status).toBe(1)
    expect(r.stdout + r.stderr).not.toContain(NEW)
  })
  test('refuses piped / non-interactive input; config untouched', async () => {
    const before = (await db.doc('adminSession/config').get()).data()
    const r = spawnSync(process.execPath, [path.join(ROOT, 'functions', 'scripts', 'admin-device-owner.cjs'), ...base, `--confirm=${PROJECT}`], { encoding: 'utf8', input: `${NEW}\n${NEW}\n` })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/interactive terminal/)
    expect(r.stdout + r.stderr).not.toContain(NEW)
    expect((await db.doc('adminSession/config').get()).data()).toEqual(before)
  })
})

describe('hidden terminal input', () => {
  const { readHidden } = require(path.join(ROOT, 'functions', 'scripts', 'adminPasswordRotation.cjs'))
  const { EventEmitter } = require('node:events')
  const fakeTty = () => {
    const input = Object.assign(new EventEmitter(), { isTTY: true, raw: [], setRawMode(v) { this.raw.push(v) }, resume() {}, pause() {} })
    const written = []
    return { input, output: { write: (s) => written.push(s) }, written }
  }
  test('reads without echoing, handles backspace, restores the terminal', async () => {
    const t = fakeTty()
    const p = readHidden('Pw: ', t)
    t.input.emit('data', Buffer.from('secrxt\u007f\u007fet-value\r'))
    expect(await p).toBe('secret-value')
    expect(t.written.join('')).toBe('Pw: \n') // nothing typed is echoed
    expect(t.input.raw).toEqual([true, false])
  })
  test('Ctrl+C cancels', async () => {
    const t = fakeTty()
    const p = readHidden('Pw: ', t)
    t.input.emit('data', Buffer.from('abc\u0003'))
    await expect(p).rejects.toThrow(/Cancelled/)
    expect(t.input.raw).toEqual([true, false])
  })
})
