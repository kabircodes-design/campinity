/**
 * Admin device authorization (server side).
 *
 * Builds on the existing admin architecture — Firebase sign-in + the
 * scrypt-hashed admin password (adminSession/config) + server-stored
 * session tokens (adminSession/tokens/items) — and adds: an admin session
 * can only be created, and only be used, from an ENROLLED DEVICE that
 * proves possession of a non-exportable private key on every call.
 *
 *  Device key   P-256 (ECDSA/SHA-256). Android: generated inside Android
 *               Keystore (hardware-backed where available), never leaves
 *               the phone. Browser: WebCrypto non-extractable key kept in
 *               that browser's IndexedDB (software-protected).
 *  Enrollment   needs ALL of: Firebase sign-in, the admin password, a
 *               one-time enrollment code (10 min, single use, bound to the
 *               owner's uid when known) created either by the owner script
 *               (Google Cloud credentials) or from an already-enrolled
 *               device's session, plus a signature from the new key over a
 *               server challenge (proof of possession). The code is checked
 *               BEFORE the password, so without a valid code there is no
 *               password-guessing oracle at all.
 *  Login        Firebase sign-in + enrolled, active device owned by that
 *               uid (checked BEFORE the password — an unenrolled device
 *               never reaches the password check) + password + signature
 *               over a single-use, 2-minute server challenge.
 *  Every call   carries deviceProof {ts, nonce, sig}: a device signature
 *               over (session-token hash, timestamp, nonce, hash of the
 *               request body), from the same Firebase account that
 *               created the session. Server rejects stale timestamps (±2 min),
 *               reused nonces (per session), revoked devices, idle (30
 *               min) and absolute (8 h) expiry. A copied session token is
 *               useless without the phone's key.
 *  Revocation   immediate: device status -> revoked, all its sessions are
 *               deleted, and every call re-checks the device.
 *  Rate limit   per Firebase uid: 5 failed auth steps / 15 min -> 15 min
 *               lock. Codes are 60-bit random; a code dies after 3 wrong
 *               passwords.
 *
 * Stored secrets are hashes only: session tokens and enrollment codes are
 * stored as SHA-256 hashes (doc ids); the password stays scrypt-hashed.
 * All collections used here are covered by the catch-all `allow read,
 * write: if false` rule — reachable only through these functions.
 */
const crypto = require('crypto')

const API_VERSION = 2
const MIN = 60 * 1000
const SESSION_ABSOLUTE_MS = 8 * 60 * MIN
const SESSION_IDLE_MS = 30 * MIN
const CHALLENGE_TTL_MS = 2 * MIN
const ENROLL_CODE_TTL_MS = 10 * MIN
const PROOF_MAX_SKEW_MS = 2 * MIN
const NONCE_MEMORY_MS = 2 * PROOF_MAX_SKEW_MS + MIN
const NONCE_MEMORY_MAX = 200
const RATE_WINDOW_MS = 15 * MIN
const RATE_MAX_FAILURES = 5
const RATE_LOCK_MS = 15 * MIN
const CODE_MAX_PASSWORD_FAILURES = 3
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32 (no I L O U)

const COL = { devices: 'adminDevices', codes: 'adminEnrollmentCodes', challenges: 'adminAuthChallenges', attempts: 'adminAuthAttempts' }

const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex')
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Deterministic JSON: object keys sorted recursively (client mirrors this exactly). */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value)
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

function bodyHashOf(data) {
  const { deviceProof, ...rest } = data || {}
  return sha256hex(stableStringify(rest))
}

const messages = {
  login: (challengeId, nonce, deviceId) => `campinity-admin/login/v1\n${challengeId}\n${nonce}\n${deviceId}`,
  enroll: (challengeId, nonce) => `campinity-admin/enroll/v1\n${challengeId}\n${nonce}`,
  call: (tokenHash, ts, nonce, bodyHash) => `campinity-admin/call/v1\n${tokenHash}\n${ts}\n${nonce}\n${bodyHash}`
}

/** Parses an SPKI (base64 DER) public key; only EC P-256 is accepted. */
function parsePublicKey(spkiB64) {
  if (typeof spkiB64 !== 'string' || spkiB64.length < 80 || spkiB64.length > 400) return null
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(spkiB64, 'base64'), format: 'der', type: 'spki' })
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return null
    return key
  } catch {
    return null
  }
}

/** Accepts both DER (Android Signature) and raw r||s (WebCrypto) ECDSA encodings. */
function verifySignature(spkiB64, message, sigB64) {
  const key = parsePublicKey(spkiB64)
  if (!key || typeof sigB64 !== 'string' || sigB64.length > 200) return false
  try {
    const sig = Buffer.from(sigB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    const dsaEncoding = sig.length === 64 ? 'ieee-p1363' : 'der'
    return crypto.verify('sha256', Buffer.from(message, 'utf8'), { key, dsaEncoding }, sig)
  } catch {
    return false
  }
}

function newEnrollmentCode() {
  const bytes = crypto.randomBytes(12)
  let code = ''
  for (let i = 0; i < 12; i++) code += CODE_ALPHABET[bytes[i] % 32]
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`
}
const normalizeCode = (c) => (typeof c === 'string' ? c.toUpperCase().replace(/[^0-9A-Z]/g, '') : '')

/**
 * Writes a one-time enrollment code (stored hashed). Shared by the
 * in-app "approve a new device" action and the owner script.
 */
async function createEnrollmentCodeRecord(firestore, Timestamp, { createdVia, createdByDeviceId = null, forUid = null, nowMs = Date.now() }) {
  const code = newEnrollmentCode()
  await firestore.collection(COL.codes).doc(sha256hex(normalizeCode(code))).set({
    createdAt: Timestamp.fromMillis(nowMs),
    expiresAt: Timestamp.fromMillis(nowMs + ENROLL_CODE_TTL_MS),
    usedAt: null,
    createdVia,
    createdByDeviceId,
    forUid,
    failedAttempts: 0
  })
  return { code, expiresAtMs: nowMs + ENROLL_CODE_TTL_MS }
}

function makeAdminDeviceAuth({ db, admin, HttpsError, logAdminAction, hashSecret, adminConfigDoc, now = () => Date.now() }) {
  const { Timestamp, FieldValue } = admin.firestore
  const d = () => db()
  const sessionDoc = (tokenHash) => d().collection('adminSession').doc('tokens').collection('items').doc(tokenHash)
  const ms = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null)
  const fail = (code, msg) => new HttpsError(code, msg)
  const audit = (entry) => logAdminAction(entry).catch(() => {})

  function requireUid(request) {
    const uid = request.auth?.uid
    if (!uid) throw fail('unauthenticated', 'You need to be signed in.')
    return uid
  }

  // ---------------------------------------------------------------- rate limit
  async function assertNotLocked(uid) {
    const snap = await d().collection(COL.attempts).doc(uid).get()
    const lockedUntil = snap.exists ? ms(snap.data().lockedUntil) : null
    if (lockedUntil && lockedUntil > now()) {
      throw fail('resource-exhausted', `Too many failed attempts. Try again in ${Math.ceil((lockedUntil - now()) / MIN)} min.`)
    }
  }
  async function recordFailure(uid) {
    const ref = d().collection(COL.attempts).doc(uid)
    await d().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const t = now()
      const prev = snap.exists ? snap.data() : {}
      const fresh = !prev.windowStart || ms(prev.windowStart) < t - RATE_WINDOW_MS
      const failures = (fresh ? 0 : prev.failures || 0) + 1
      tx.set(ref, {
        windowStart: fresh ? Timestamp.fromMillis(t) : prev.windowStart,
        failures,
        lockedUntil: failures >= RATE_MAX_FAILURES ? Timestamp.fromMillis(t + RATE_LOCK_MS) : prev.lockedUntil || null
      })
    })
  }
  const clearFailures = (uid) => d().collection(COL.attempts).doc(uid).delete().catch(() => {})

  async function passwordMatches(password) {
    if (typeof password !== 'string' || !password) return false
    const configSnap = await adminConfigDoc().get()
    if (!configSnap.exists) throw fail('failed-precondition', 'No admin password has been set up yet.')
    const { hash, salt } = configSnap.data()
    const a = Buffer.from(hash, 'hex')
    const b = Buffer.from(await hashSecret(password, salt), 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  function newSession(tx, { uid, deviceId }) {
    const token = crypto.randomBytes(32).toString('hex')
    const t = now()
    tx.set(sessionDoc(sha256hex(token)), {
      createdByUid: uid,
      deviceId,
      createdAt: Timestamp.fromMillis(t),
      expiresAt: Timestamp.fromMillis(t + SESSION_ABSOLUTE_MS),
      idleExpiresAt: Timestamp.fromMillis(t + SESSION_IDLE_MS),
      recentNonces: []
    })
    return { sessionToken: token, expiresAtMs: t + SESSION_ABSOLUTE_MS, idleTimeoutMs: SESSION_IDLE_MS }
  }

  async function newChallenge(fields) {
    const ref = d().collection(COL.challenges).doc(b64url(crypto.randomBytes(18)))
    const nonce = b64url(crypto.randomBytes(32))
    await ref.set({ ...fields, nonce, createdAt: Timestamp.fromMillis(now()), expiresAt: Timestamp.fromMillis(now() + CHALLENGE_TTL_MS), usedAt: null })
    return { challengeId: ref.id, nonce }
  }

  /** Reads + burns a challenge inside a transaction. Returns its data or throws. */
  async function takeChallenge(tx, challengeId, uid, purpose) {
    if (typeof challengeId !== 'string' || !/^[A-Za-z0-9_-]{10,40}$/.test(challengeId)) throw fail('invalid-argument', 'Invalid challenge.')
    const ref = d().collection(COL.challenges).doc(challengeId)
    const snap = await tx.get(ref)
    if (!snap.exists) throw fail('permission-denied', 'This sign-in attempt is no longer valid. Start again.')
    const c = snap.data()
    if (c.purpose !== purpose || c.uid !== uid) throw fail('permission-denied', 'This sign-in attempt is no longer valid. Start again.')
    if (c.usedAt) throw fail('permission-denied', 'This sign-in attempt was already used. Start again.')
    if (ms(c.expiresAt) < now()) throw fail('deadline-exceeded', 'This sign-in attempt expired. Start again.')
    return { ref, c }
  }

  // ---------------------------------------------------------------- endpoints
  function getCapabilities() {
    // Non-sensitive: lets clients refuse to run against an older backend
    // (e.g. the verification list that used to auto-approve).
    return { apiVersion: API_VERSION, deviceAuth: true, verificationListReadOnly: true, sessionIdleMs: SESSION_IDLE_MS, sessionAbsoluteMs: SESSION_ABSOLUTE_MS }
  }

  async function login(request) {
    const uid = requireUid(request)
    const { password, deviceId } = request.data || {}
    if (typeof password !== 'string' || !password) throw fail('invalid-argument', 'Missing password.')
    await assertNotLocked(uid)

    // Device first: an unenrolled device never reaches the password check.
    const deviceSnap = typeof deviceId === 'string' && /^[a-f0-9]{32}$/.test(deviceId) ? await d().collection(COL.devices).doc(deviceId).get() : null
    const device = deviceSnap && deviceSnap.exists ? deviceSnap.data() : null
    if (!device || device.status !== 'active' || device.ownerUid !== uid) {
      await recordFailure(uid)
      await audit({ adminUid: uid, action: 'admin_login_unauthorized_device', targetType: 'adminDevice', targetId: typeof deviceId === 'string' ? deviceId.slice(0, 40) : null })
      throw fail('permission-denied', 'This device is not authorized for admin access.')
    }
    if (!(await passwordMatches(password))) {
      await recordFailure(uid)
      await audit({ adminUid: uid, action: 'admin_login_failed', targetType: 'adminSession', targetId: deviceId })
      return { ok: false }
    }
    return { ok: true, ...(await newChallenge({ purpose: 'login', uid, deviceId })) }
  }

  async function loginFinish(request) {
    const uid = requireUid(request)
    const { challengeId, signature } = request.data || {}
    let badSignature = false
    let result
    await d().runTransaction(async (tx) => {
      const { ref, c } = await takeChallenge(tx, challengeId, uid, 'login')
      const devRef = d().collection(COL.devices).doc(c.deviceId)
      const dev = await tx.get(devRef)
      if (!dev.exists || dev.data().status !== 'active' || dev.data().ownerUid !== uid) throw fail('permission-denied', 'This device is not authorized for admin access.')
      tx.update(ref, { usedAt: Timestamp.fromMillis(now()) }) // single use, success or not
      if (!verifySignature(dev.data().publicKeySpki, messages.login(challengeId, c.nonce, c.deviceId), signature)) {
        badSignature = true
        return
      }
      tx.update(devRef, { lastUsedAt: Timestamp.fromMillis(now()) })
      result = { ok: true, deviceId: c.deviceId, ...newSession(tx, { uid, deviceId: c.deviceId }) }
    })
    if (badSignature) {
      await recordFailure(uid)
      await audit({ adminUid: uid, action: 'admin_login_bad_signature', targetType: 'adminSession' })
      throw fail('permission-denied', 'Device signature could not be verified.')
    }
    await clearFailures(uid)
    await audit({ adminUid: uid, action: 'admin_login', targetType: 'adminSession', targetId: result.deviceId })
    return result
  }

  async function enrollStart(request) {
    const uid = requireUid(request)
    const { password, enrollmentCode, publicKey, label, platform } = request.data || {}
    if (!['android', 'web'].includes(platform)) throw fail('invalid-argument', 'Unknown device platform.')
    await assertNotLocked(uid)

    // Code first: without a valid code there's no password oracle.
    const codeHash = sha256hex(normalizeCode(enrollmentCode))
    const codeRef = d().collection(COL.codes).doc(codeHash)
    const codeSnap = normalizeCode(enrollmentCode).length === 12 ? await codeRef.get() : null
    const code = codeSnap && codeSnap.exists ? codeSnap.data() : null
    if (!code || code.usedAt || ms(code.expiresAt) < now() || (code.forUid && code.forUid !== uid)) {
      await recordFailure(uid)
      await audit({ adminUid: uid, action: 'admin_enroll_failed', targetType: 'adminDevice', reason: 'invalid_or_expired_code' })
      throw fail('permission-denied', 'This enrollment code is invalid or has expired.')
    }
    if (!(await passwordMatches(password))) {
      await recordFailure(uid)
      const failedAttempts = (code.failedAttempts || 0) + 1
      await codeRef.update({ failedAttempts, ...(failedAttempts >= CODE_MAX_PASSWORD_FAILURES ? { usedAt: Timestamp.fromMillis(now()), voided: true } : {}) })
      await audit({ adminUid: uid, action: 'admin_enroll_failed', targetType: 'adminDevice', reason: 'wrong_password' })
      return { ok: false }
    }
    if (!parsePublicKey(publicKey)) throw fail('invalid-argument', 'Device key is not a valid P-256 public key.')
    const keyFingerprint = sha256hex(Buffer.from(publicKey, 'base64').toString('hex'))
    const dup = await d().collection(COL.devices).where('keyFingerprint', '==', keyFingerprint).limit(1).get()
    if (!dup.empty) throw fail('already-exists', 'This device key is already enrolled.')
    const cleanLabel = (typeof label === 'string' ? label : '').replace(/[^\p{L}\p{N} ._'()-]/gu, '').trim().slice(0, 60) || (platform === 'android' ? 'Android phone' : 'Browser')
    return { ok: true, ...(await newChallenge({ purpose: 'enroll', uid, codeHash, publicKey, keyFingerprint, label: cleanLabel, platform })) }
  }

  async function enrollFinish(request) {
    const uid = requireUid(request)
    const { challengeId, signature } = request.data || {}
    let badSignature = false
    let result
    await d().runTransaction(async (tx) => {
      const { ref, c } = await takeChallenge(tx, challengeId, uid, 'enroll')
      const codeRef = d().collection(COL.codes).doc(c.codeHash)
      const code = await tx.get(codeRef)
      if (!code.exists || code.data().usedAt || ms(code.data().expiresAt) < now()) throw fail('permission-denied', 'This enrollment code is invalid or has expired.')
      tx.update(ref, { usedAt: Timestamp.fromMillis(now()) })
      if (!verifySignature(c.publicKey, messages.enroll(challengeId, c.nonce), signature)) {
        badSignature = true
        return
      }
      const deviceId = crypto.randomBytes(16).toString('hex')
      tx.update(codeRef, { usedAt: Timestamp.fromMillis(now()), usedByUid: uid, deviceId })
      tx.set(d().collection(COL.devices).doc(deviceId), {
        ownerUid: uid,
        label: c.label,
        platform: c.platform,
        publicKeySpki: c.publicKey,
        keyFingerprint: c.keyFingerprint,
        status: 'active',
        enrolledAt: Timestamp.fromMillis(now()),
        enrolledVia: code.data().createdVia || 'unknown',
        approvedByDeviceId: code.data().createdByDeviceId || null,
        lastUsedAt: Timestamp.fromMillis(now()),
        revokedAt: null
      })
      result = { ok: true, deviceId, ...newSession(tx, { uid, deviceId }) }
    })
    if (badSignature) {
      await recordFailure(uid)
      await audit({ adminUid: uid, action: 'admin_enroll_failed', targetType: 'adminDevice', reason: 'bad_signature' })
      throw fail('permission-denied', 'Device signature could not be verified.')
    }
    await clearFailures(uid)
    await audit({ adminUid: uid, action: 'admin_device_enrolled', targetType: 'adminDevice', targetId: result.deviceId })
    return result
  }

  /**
   * The gate every privileged admin function calls. Verifies the session
   * AND a fresh device signature over this exact request.
   */
  async function requireValidAdminSession(sessionToken, request) {
    if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length > 128) throw fail('unauthenticated', 'Admin session required.')
    const proof = request && request.data && request.data.deviceProof
    if (!proof || typeof proof.ts !== 'number' || typeof proof.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(proof.nonce) || typeof proof.sig !== 'string') {
      throw fail('unauthenticated', 'Device proof required. Update the admin app and sign in again.')
    }
    const t = now()
    if (Math.abs(t - proof.ts) > PROOF_MAX_SKEW_MS) throw fail('unauthenticated', "Request expired. Check this device's date and time, then try again.")
    const tokenHash = sha256hex(sessionToken)
    const message = messages.call(tokenHash, proof.ts, proof.nonce, bodyHashOf(request.data))
    let outcome
    await d().runTransaction(async (tx) => {
      const ref = sessionDoc(tokenHash)
      const snap = await tx.get(ref)
      if (!snap.exists) {
        outcome = { error: ['unauthenticated', 'Admin session is invalid. Please sign in again.'] }
        return
      }
      const s = snap.data()
      if (ms(s.expiresAt) < t || (s.idleExpiresAt && ms(s.idleExpiresAt) < t)) {
        tx.delete(ref)
        outcome = { error: ['unauthenticated', 'Admin session has expired. Please sign in again.'] }
        return
      }
      const dev = s.deviceId ? await tx.get(d().collection(COL.devices).doc(s.deviceId)) : null
      // The session belongs to one Firebase account: the caller must be signed in as it.
      if (!request.auth || request.auth.uid !== s.createdByUid) {
        outcome = { error: ['unauthenticated', 'Sign in with the account that unlocked this admin session.'] }
        return
      }
      if (!dev || !dev.exists || dev.data().status !== 'active') {
        tx.delete(ref)
        outcome = { error: ['unauthenticated', 'This device is no longer authorized.'] }
        return
      }
      if (!verifySignature(dev.data().publicKeySpki, message, proof.sig)) {
        outcome = { error: ['unauthenticated', 'Device signature could not be verified.'] }
        return
      }
      const recent = (s.recentNonces || []).filter((x) => x.t > t - NONCE_MEMORY_MS)
      if (recent.some((x) => x.n === proof.nonce)) {
        outcome = { error: ['unauthenticated', 'This request was already used.'] }
        return
      }
      recent.push({ n: proof.nonce, t })
      tx.update(ref, {
        recentNonces: recent.slice(-NONCE_MEMORY_MAX),
        idleExpiresAt: Timestamp.fromMillis(Math.min(t + SESSION_IDLE_MS, ms(s.expiresAt))),
        lastSeenAt: Timestamp.fromMillis(t)
      })
      outcome = { session: { createdByUid: s.createdByUid, deviceId: s.deviceId, expiresAt: s.expiresAt } }
    })
    if (outcome.error) throw fail(outcome.error[0], outcome.error[1])
    return outcome.session
  }

  async function logout(request) {
    const { sessionToken } = request.data || {}
    if (sessionToken && typeof sessionToken === 'string' && sessionToken.length <= 128) {
      await sessionDoc(sha256hex(sessionToken)).delete().catch(() => {})
    }
    return { ok: true }
  }

  async function listDevices(request) {
    const session = await requireValidAdminSession((request.data || {}).sessionToken, request)
    const snap = await d().collection(COL.devices).where('ownerUid', '==', session.createdByUid).limit(50).get()
    const devices = snap.docs
      .map((x) => {
        const v = x.data()
        return {
          id: x.id,
          label: v.label || '',
          platform: v.platform || '',
          status: v.status || 'active',
          enrolledAtMs: ms(v.enrolledAt),
          lastUsedAtMs: ms(v.lastUsedAt),
          revokedAtMs: ms(v.revokedAt),
          enrolledVia: v.enrolledVia || null,
          fingerprint: (v.keyFingerprint || '').slice(0, 16),
          isCurrent: x.id === session.deviceId
        }
      })
      .sort((a, b) => (a.status === b.status ? (b.lastUsedAtMs || 0) - (a.lastUsedAtMs || 0) : a.status === 'active' ? -1 : 1))
    return { devices }
  }

  async function revokeDevice(request) {
    const { sessionToken, deviceId } = request.data || {}
    const session = await requireValidAdminSession(sessionToken, request)
    if (typeof deviceId !== 'string' || !/^[a-f0-9]{32}$/.test(deviceId)) throw fail('invalid-argument', 'Missing device.')
    const ref = d().collection(COL.devices).doc(deviceId)
    const snap = await ref.get()
    if (!snap.exists || snap.data().ownerUid !== session.createdByUid) throw fail('not-found', 'Device not found.')
    if (snap.data().status === 'revoked') return { ok: true, alreadyRevoked: true }
    await ref.update({ status: 'revoked', revokedAt: Timestamp.fromMillis(now()), revokedByDeviceId: session.deviceId })
    const sessions = await d().collection('adminSession').doc('tokens').collection('items').where('deviceId', '==', deviceId).get()
    await Promise.all(sessions.docs.map((x) => x.ref.delete()))
    await audit({ adminUid: session.createdByUid, action: 'admin_device_revoked', targetType: 'adminDevice', targetId: deviceId })
    return { ok: true, revokedCurrent: deviceId === session.deviceId, sessionsEnded: sessions.size }
  }

  async function createEnrollmentCode(request) {
    const session = await requireValidAdminSession((request.data || {}).sessionToken, request)
    const res = await createEnrollmentCodeRecord(d(), Timestamp, { createdVia: 'device', createdByDeviceId: session.deviceId, forUid: session.createdByUid, nowMs: now() })
    await audit({ adminUid: session.createdByUid, action: 'admin_enrollment_code_created', targetType: 'adminDevice', reason: 'approved from enrolled device' })
    return res
  }

  return { getCapabilities, login, loginFinish, enrollStart, enrollFinish, requireValidAdminSession, logout, listDevices, revokeDevice, createEnrollmentCode }
}

module.exports = {
  makeAdminDeviceAuth,
  createEnrollmentCodeRecord,
  _internal: { stableStringify, bodyHashOf, messages, verifySignature, parsePublicKey, sha256hex, normalizeCode, newEnrollmentCode, constants: { API_VERSION, SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, CHALLENGE_TTL_MS, ENROLL_CODE_TTL_MS, PROOF_MAX_SKEW_MS, RATE_MAX_FAILURES } }
}
