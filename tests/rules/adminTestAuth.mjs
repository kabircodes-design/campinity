// Test helpers for device-bound admin sessions (API v2). Mirrors exactly
// what the admin app does: a P-256 device key, a session stored under the
// SHA-256 of its token, and a per-request signature (deviceProof).
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const FUNCTIONS = path.resolve(here, '..', '..', 'functions', 'functions')
const require = createRequire(path.join(FUNCTIONS, 'index.js'))
export const deviceInternals = require(path.join(FUNCTIONS, 'adminDevice.js'))._internal

/** dsa: 'der' like Android Keystore, 'ieee-p1363' like WebCrypto. */
export function newDeviceKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  return { privateKey, publicKeySpki: publicKey.export({ format: 'der', type: 'spki' }).toString('base64') }
}

export const signWith = (privateKey, message, dsa = 'der') =>
  crypto.sign('sha256', Buffer.from(message, 'utf8'), { key: privateKey, dsaEncoding: dsa }).toString('base64')

export async function seedDevice(db, Timestamp, { uid, status = 'active', label = 'Test phone', platform = 'android' } = {}) {
  const key = newDeviceKey()
  const deviceId = crypto.randomBytes(16).toString('hex')
  await db.doc(`adminDevices/${deviceId}`).set({
    ownerUid: uid,
    label,
    platform,
    publicKeySpki: key.publicKeySpki,
    keyFingerprint: deviceInternals.sha256hex(Buffer.from(key.publicKeySpki, 'base64').toString('hex')),
    status,
    enrolledAt: Timestamp.now(),
    enrolledVia: 'test',
    lastUsedAt: Timestamp.now(),
    revokedAt: null
  })
  return { deviceId, ...key }
}

export async function seedSession(db, Timestamp, { uid, deviceId, token = crypto.randomBytes(32).toString('hex'), expiresInMs = 3600_000, idleInMs = 1800_000 } = {}) {
  const now = Date.now()
  await db.doc(`adminSession/tokens/items/${deviceInternals.sha256hex(token)}`).set({
    createdByUid: uid,
    deviceId,
    createdAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + expiresInMs),
    idleExpiresAt: Timestamp.fromMillis(now + idleInMs),
    recentNonces: []
  })
  return token
}

/** Adds a valid deviceProof for `data` (which must contain sessionToken). */
export function withProof(data, privateKey, { ts = Date.now(), nonce = crypto.randomBytes(16).toString('hex'), dsa = 'der' } = {}) {
  const { messages, bodyHashOf, sha256hex } = deviceInternals
  const token = data.sessionToken || ''
  const sig = signWith(privateKey, messages.call(sha256hex(token), ts, nonce, bodyHashOf(data)), dsa)
  return { ...data, deviceProof: { ts, nonce, sig } }
}
