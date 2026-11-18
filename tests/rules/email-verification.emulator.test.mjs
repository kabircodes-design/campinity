// Custom email verification — the REAL callables (createEmailVerification,
// resendEmailVerification, verifyEmailVerificationToken) against the
// Firestore emulator. Resend is replaced by a fake HTTP endpoint and
// Firebase Auth by an in-memory stand-in, so NO real email is sent here —
// real delivery is a separate, production-only check.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const FUNCTIONS = path.resolve(here, '..', '..', 'functions', 'functions')
const require = createRequire(path.join(FUNCTIONS, 'index.js'))
const PORT = process.env.FIRESTORE_EMULATOR_PORT || '8089'
const PROJECT = 'demo-campinity-rules'
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`
process.env.GCLOUD_PROJECT = PROJECT
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT })
process.env.RESEND_API_KEY = 're_test_not_a_real_key'

const fns = require(path.join(FUNCTIONS, 'index.js'))
const { _internal: mailInternal } = require(path.join(FUNCTIONS, 'email', 'mailer.js'))
const admin = require('firebase-admin')
const db = admin.firestore()
const { Timestamp } = admin.firestore

// ---- in-memory Firebase Auth stand-in
const users = new Map()
const authCalls = []
const fakeAuth = {
  getUser: async (uid) => {
    if (!users.has(uid)) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' })
    return { ...users.get(uid) }
  },
  updateUser: async (uid, patch) => {
    authCalls.push([uid, patch])
    users.set(uid, { ...users.get(uid), ...patch })
    return users.get(uid)
  }
}
const authDescriptor = Object.getOwnPropertyDescriptor(admin, 'auth')
// ---- fake Resend
let resend
const sent = []
const realFetch = globalThis.fetch
function installFetch() {
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      const body = JSON.parse(init.body)
      sent.push({ headers: init.headers, body })
      return resend(body)
    }
    return realFetch(url, init)
  }
}
const ok = () => ({ ok: true, status: 200, json: async () => ({ id: 'email_' + crypto.randomBytes(4).toString('hex') }) })
const call = (name, data = {}, uid = 'u1') => fns[name].run({ data, auth: uid ? { uid, token: {} } : null, rawRequest: { headers: {} } })
const tokenFrom = (msg) => msg.body.html.match(/token=([a-f0-9]{64})/)[1]
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex')

beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  Object.defineProperty(admin, 'auth', { configurable: true, get: () => () => fakeAuth })
})
afterAll(async () => {
  if (authDescriptor) Object.defineProperty(admin, 'auth', authDescriptor)
  else delete admin.auth
  globalThis.fetch = realFetch
  await Promise.all(admin.apps.map((a) => a.delete()))
})
beforeEach(async () => {
  users.clear()
  users.set('u1', { uid: 'u1', email: 'new.student@example.test', emailVerified: false, displayName: 'Asha Rao' })
  users.set('u2', { uid: 'u2', email: 'other@example.test', emailVerified: false, displayName: '' })
  authCalls.length = 0
  sent.length = 0
  resend = ok
  installFetch()
  delete process.env.EMAIL_FROM_ADDRESS
  for (const c of ['emailVerificationTokens', 'emailVerificationActiveTokens', 'emailVerificationRateLimits']) {
    const s = await db.collection(c).get()
    await Promise.all(s.docs.map((d) => d.ref.delete()))
  }
})
afterEach(() => vi.restoreAllMocks())
const skipCooldown = (uid = 'u1') => db.doc(`emailVerificationRateLimits/${uid}`).update({ lastSentAt: Timestamp.fromMillis(Date.now() - 61_000) })

describe('sending', () => {
  test('signup send: branded email via Resend to the account email; only the token HASH is stored', async () => {
    process.env.EMAIL_FROM_ADDRESS = 'Campinity <verify@mail.example.test>'
    const res = await call('createEmailVerification')
    expect(res).toMatchObject({ ok: true, expiresInMinutes: 20, resendAvailableInSeconds: 60 })
    expect(res.expiresAtMs - Date.now()).toBeGreaterThan(19 * 60_000)
    expect(sent).toHaveLength(1)
    const m = sent[0]
    expect(m.body).toMatchObject({ from: 'Campinity <verify@mail.example.test>', to: ['new.student@example.test'], subject: 'Verify your email for Campinity' })
    expect(m.headers['Idempotency-Key']).toMatch(/^verify-[a-f0-9]{40}$/)
    expect(m.body.html).toContain('CAMPINITY')
    expect(m.body.html).toContain('Find Your Campus. Find Your People.')
    expect(m.body.html).toContain('Verify email address')
    expect(m.body.html).toContain('20 minutes')
    expect(m.body.html).toContain('Hi Asha,')
    expect(m.body.text).toMatch(/verify-email\?token=[a-f0-9]{64}/)
    const token = tokenFrom(m)
    expect((await db.doc(`emailVerificationTokens/${sha(token)}`).get()).data()).toMatchObject({ uid: 'u1', status: 'active', email: 'new.student@example.test' })
    const all = JSON.stringify((await db.collection('emailVerificationTokens').get()).docs.map((d) => d.data()))
    expect(all).not.toContain(token)
  })

  test('requires sign-in; email and uid come only from the auth context (client data ignored)', async () => {
    await expect(call('createEmailVerification', {}, null)).rejects.toMatchObject({ code: 'unauthenticated' })
    await call('createEmailVerification', { email: 'attacker@evil.test', uid: 'u2' }, 'u1')
    expect(sent[0].body.to).toEqual(['new.student@example.test'])
  })

  test('already-verified account: no email, alreadyVerified', async () => {
    users.set('u1', { ...users.get('u1'), emailVerified: true })
    await expect(call('createEmailVerification')).resolves.toEqual({ ok: true, alreadyVerified: true })
    expect(sent).toHaveLength(0)
  })

  test('Resend rejection (unverified sender domain): clear error, budget refunded, reason logged without secrets', async () => {
    resend = () => ({ ok: false, status: 403, json: async () => ({ name: 'validation_error', message: 'The campinity.in domain is not verified. Please, add and verify your domain on https://resend.com/domains to: new.student@example.test' }) })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(call('createEmailVerification')).rejects.toMatchObject({ code: 'unavailable', details: { reason: 'send-failed' } })
    const logged = JSON.stringify(spy.mock.calls)
    expect(logged).toContain('403')
    expect(logged).toContain('validation_error')
    expect(logged).toContain('domain is not verified')
    expect(logged).not.toContain('new.student@example.test')
    expect(logged).not.toContain('re_test_not_a_real_key')
    expect(logged).not.toMatch(/token=/)
    // budget refunded, no token persisted
    expect((await db.doc('emailVerificationRateLimits/u1').get()).data().count).toBe(0)
    expect((await db.collection('emailVerificationTokens').get()).size).toBe(0)
    // three more failures still don't lock the user out with "too many"
    for (let i = 0; i < 3; i++) await expect(call('resendEmailVerification')).rejects.toMatchObject({ code: 'unavailable' })
    resend = ok
    await expect(call('resendEmailVerification')).resolves.toMatchObject({ ok: true })
  })

  test('missing API key / network failure are reported as unavailable (never as sent)', async () => {
    const key = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(call('createEmailVerification')).rejects.toMatchObject({ code: 'unavailable' })
    process.env.RESEND_API_KEY = key
    resend = () => {
      throw new Error('getaddrinfo ENOTFOUND api.resend.com')
    }
    await expect(call('createEmailVerification')).rejects.toMatchObject({ code: 'unavailable' })
  })
})

describe('resend', () => {
  test('60 s cooldown between sends, with retryAfterSeconds for the UI countdown', async () => {
    await call('createEmailVerification')
    const err = await call('resendEmailVerification').catch((e) => e)
    expect(err).toMatchObject({ code: 'resource-exhausted', details: { reason: 'cooldown' } })
    expect(err.details.retryAfterSeconds).toBeGreaterThan(50)
    expect(sent).toHaveLength(1)
  })

  test('at most 3 emails per 15 minutes', async () => {
    for (let i = 0; i < 3; i++) {
      await call(i ? 'resendEmailVerification' : 'createEmailVerification')
      await skipCooldown()
    }
    const err = await call('resendEmailVerification').catch((e) => e)
    expect(err).toMatchObject({ code: 'resource-exhausted', details: { reason: 'rate-limited' } })
    expect(sent).toHaveLength(3)
  })

  test('resend invalidates the previous link; the old link says "superseded", the new one works', async () => {
    await call('createEmailVerification')
    const first = tokenFrom(sent[0])
    await skipCooldown()
    await call('resendEmailVerification')
    const second = tokenFrom(sent[1])
    expect(first).not.toBe(second)
    await expect(call('verifyEmailVerificationToken', { token: first }, null)).rejects.toMatchObject({ details: { reason: 'superseded' } })
    expect(users.get('u1').emailVerified).toBe(false)
    await expect(call('verifyEmailVerificationToken', { token: second }, null)).resolves.toEqual({ ok: true })
    expect(users.get('u1').emailVerified).toBe(true)
  })
})

describe('verification', () => {
  async function issue(uid = 'u1') {
    await call('createEmailVerification', {}, uid)
    return tokenFrom(sent[sent.length - 1])
  }

  test('valid link verifies exactly that account — works with no session (other device / mail app)', async () => {
    const token = await issue()
    await expect(call('verifyEmailVerificationToken', { token }, null)).resolves.toEqual({ ok: true })
    expect(authCalls).toEqual([['u1', { emailVerified: true }]])
    expect((await db.doc(`emailVerificationTokens/${sha(token)}`).get()).data().status).toBe('verified')
  })

  test('clicking again / refreshing / mail-scanner pre-open: idempotent success, no second Auth write', async () => {
    const token = await issue()
    await call('verifyEmailVerificationToken', { token }, null)
    await expect(call('verifyEmailVerificationToken', { token }, null)).resolves.toEqual({ ok: true, alreadyVerified: true })
    expect(authCalls).toHaveLength(1)
  })

  test('concurrent double click: account verified once, no server error', async () => {
    const token = await issue()
    const results = await Promise.allSettled([call('verifyEmailVerificationToken', { token }, null), call('verifyEmailVerificationToken', { token }, null)])
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true)
    for (const r of results) if (r.status === 'rejected') expect(r.reason.details?.reason).toBe('already-used')
    expect(users.get('u1').emailVerified).toBe(true)
    expect(authCalls).toHaveLength(1)
  })

  test('expired link', async () => {
    const token = await issue()
    await db.doc(`emailVerificationTokens/${sha(token)}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    await expect(call('verifyEmailVerificationToken', { token }, null)).rejects.toMatchObject({ details: { reason: 'expired' } })
    expect(users.get('u1').emailVerified).toBe(false)
  })

  test('invalid links: malformed, unknown, missing', async () => {
    await expect(call('verifyEmailVerificationToken', { token: 'abc' }, null)).rejects.toMatchObject({ details: { reason: 'invalid' } })
    await expect(call('verifyEmailVerificationToken', { token: 'f'.repeat(64) }, null)).rejects.toMatchObject({ details: { reason: 'invalid' } })
    await expect(call('verifyEmailVerificationToken', {}, null)).rejects.toMatchObject({ details: { reason: 'invalid' } })
  })

  test("one user's link can never verify another account; a signed-in user can't redirect it", async () => {
    const tokenA = await issue('u1')
    await call('verifyEmailVerificationToken', { token: tokenA, uid: 'u2' }, 'u2')
    expect(users.get('u1').emailVerified).toBe(true)
    expect(users.get('u2').emailVerified).toBe(false)
  })

  test('wrong email/token combination: link issued for an old address does not verify the new one', async () => {
    const token = await issue()
    users.set('u1', { ...users.get('u1'), email: 'changed@example.test' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(call('verifyEmailVerificationToken', { token }, null)).rejects.toMatchObject({ details: { reason: 'invalid' } })
    expect(users.get('u1').emailVerified).toBe(false)
  })

  test('Auth failure after claim rolls the link back so a retry still works', async () => {
    const token = await issue()
    const real = fakeAuth.updateUser
    fakeAuth.updateUser = async () => {
      throw new Error('transient')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(call('verifyEmailVerificationToken', { token }, null)).rejects.toMatchObject({ details: { reason: 'server-error' } })
    fakeAuth.updateUser = real
    await expect(call('verifyEmailVerificationToken', { token }, null)).resolves.toEqual({ ok: true })
  })
})

describe('email content', () => {
  test('HTML escapes the name and link; plain-text alternative carries the same link and expiry', () => {
    const html = mailInternal.verificationEmailHtml({ verifyUrl: 'https://x.test/verify-email?token=ab&x="1"', expiresInMinutes: 20, recipientName: '<b>Eve</b>' })
    expect(html).not.toContain('<b>Eve</b>')
    expect(html).toContain('&lt;b&gt;Eve&lt;/b&gt;')
    expect(html).toContain('token=ab&amp;x=&quot;1&quot;')
    const text = mailInternal.verificationEmailText({ verifyUrl: 'https://x.test/verify-email?token=ab', expiresInMinutes: 20, recipientName: '' })
    expect(text).toContain('https://x.test/verify-email?token=ab')
    expect(text).toContain('expires in 20 minutes')
  })
})
