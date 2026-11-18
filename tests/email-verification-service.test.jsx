// The real emailVerificationService with Firebase mocked:
//  - Firebase provider (active): sendEmailVerification with a continue URL,
//    graceful fallback when the continue URL is rejected, errors surfaced,
//    already-verified short-circuit, applyActionCode for in-app links.
//  - Custom provider (dormant): selected only by VITE_EMAIL_VERIFICATION_PROVIDER=custom;
//    its token redemption is de-duplicated per link.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const h = vi.hoisted(() => ({ sends: [], sendImpl: null, applied: [], callable: [], callableImpl: null }))
vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: null }, default: {} }))
vi.mock('firebase/auth', () => ({
  sendEmailVerification: async (user, settings) => {
    h.sends.push([user.uid, settings])
    if (h.sendImpl) return h.sendImpl(settings)
  },
  applyActionCode: async (_auth, code) => {
    h.applied.push(code)
  }
}))
vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_f, name) => async (data) => {
    h.callable.push(name)
    return h.callableImpl(name, data)
  }
}))

const user = { uid: 'u1', email: 'new@example.test', emailVerified: false }
beforeEach(() => {
  h.sends = []
  h.sendImpl = null
  h.applied = []
  h.callable = []
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})
const load = () => import(`${SRC}/firebase/emailVerificationService.js`)

describe('Firebase provider (active by default)', () => {
  test('is the active provider and never calls the Resend Cloud Functions', async () => {
    const svc = await load()
    expect(svc.EMAIL_VERIFICATION_PROVIDER).toBe('firebase')
    const res = await svc.sendVerificationEmail(user)
    expect(res).toMatchObject({ ok: true, provider: 'firebase', resendAvailableInSeconds: 60 })
    expect(h.callable).toEqual([])
  })

  test('sends with a continue URL back to /verify-email?verified=1 on this origin', async () => {
    const svc = await load()
    await svc.sendVerificationEmail(user)
    expect(h.sends).toHaveLength(1)
    expect(h.sends[0][1]).toEqual({ url: `${window.location.origin}/verify-email?verified=1`, handleCodeInApp: false })
  })

  test('a rejected continue URL never blocks the email: retries once without it', async () => {
    const svc = await load()
    h.sendImpl = (settings) => {
      if (settings) throw Object.assign(new Error('x'), { code: 'auth/unauthorized-continue-uri' })
    }
    await expect(svc.sendVerificationEmail(user)).resolves.toMatchObject({ ok: true })
    expect(h.sends.map((s) => s[1])).toEqual([expect.objectContaining({ url: expect.any(String) }), undefined])
  })

  test('other Firebase errors (rate limit, network) are surfaced, never reported as sent', async () => {
    const svc = await load()
    h.sendImpl = () => {
      throw Object.assign(new Error('x'), { code: 'auth/too-many-requests' })
    }
    await expect(svc.sendVerificationEmail(user)).rejects.toMatchObject({ code: 'auth/too-many-requests' })
    h.sendImpl = () => {
      throw Object.assign(new Error('x'), { code: 'auth/network-request-failed' })
    }
    await expect(svc.sendVerificationEmail(user)).rejects.toMatchObject({ code: 'auth/network-request-failed' })
    expect(h.sends).toHaveLength(2)
  })

  test('already verified: nothing is sent; signed out: refused', async () => {
    const svc = await load()
    await expect(svc.sendVerificationEmail({ ...user, emailVerified: true })).resolves.toEqual({ ok: true, alreadyVerified: true })
    await expect(svc.sendVerificationEmail(null)).rejects.toMatchObject({ code: 'auth/no-current-user' })
    expect(h.sends).toHaveLength(0)
  })

  test('in-app Firebase action links are applied with applyActionCode', async () => {
    const svc = await load()
    await expect(svc.applyFirebaseVerificationCode('OOB')).resolves.toEqual({ ok: true })
    expect(h.applied).toEqual(['OOB'])
  })
})

describe('custom provider (dormant until a domain exists)', () => {
  test('only VITE_EMAIL_VERIFICATION_PROVIDER=custom selects it; then Firebase is NOT used for sending', async () => {
    vi.stubEnv('VITE_EMAIL_VERIFICATION_PROVIDER', 'custom')
    const svc = await load()
    expect(svc.EMAIL_VERIFICATION_PROVIDER).toBe('custom')
    h.callableImpl = () => ({ data: { ok: true, expiresInMinutes: 20, resendAvailableInSeconds: 60 } })
    await expect(svc.sendVerificationEmail(user)).resolves.toMatchObject({ provider: 'custom', ok: true })
    expect(h.callable).toEqual(['resendEmailVerification'])
    expect(h.sends).toHaveLength(0)
  })

  test('token redemption: concurrent requests share ONE call; a failure can be retried', async () => {
    const svc = await load()
    h.callableImpl = async () => {
      await new Promise((r) => setTimeout(r, 15))
      return { data: { ok: true } }
    }
    await Promise.all([svc.verifyEmailVerificationToken('t1'), svc.verifyEmailVerificationToken('t1')])
    expect(h.callable.filter((n) => n === 'verifyEmailVerificationToken')).toHaveLength(1)
    let n = 0
    h.callableImpl = async () => {
      n++
      if (n === 1) throw Object.assign(new Error('x'), { code: 'functions/internal' })
      return { data: { ok: true } }
    }
    await expect(svc.verifyEmailVerificationToken('t2')).rejects.toBeTruthy()
    await expect(svc.verifyEmailVerificationToken('t2')).resolves.toEqual({ ok: true })
  })
})
