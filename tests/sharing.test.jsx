// Sharing helpers: public URLs (never the app's localhost origin),
// honest copy results, and native-share outcomes (cancel ≠ success).
import { afterEach, describe, expect, test, vi } from 'vitest'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const native = vi.hoisted(() => ({ isNative: false, shareImpl: null, canShare: true }))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.isNative } }))
vi.mock('@capacitor/share', () => ({
  Share: {
    canShare: async () => ({ value: native.canShare }),
    share: (opts) => native.shareImpl(opts)
  }
}))

const { getPublicAppUrl, getShareUrl, copyText, nativeShare } = await import(`${SRC}/sharing/shareTypes.js`)

afterEach(() => {
  native.isNative = false
  native.shareImpl = null
  native.canShare = true
  delete navigator.share
})

describe('share URLs', () => {
  test('the local/native origin is replaced by the public site', () => {
    // jsdom runs on http://localhost, exactly like the Android WebView (https://localhost)
    expect(getPublicAppUrl()).toBe('https://campinity-app.vercel.app')
    expect(getShareUrl('post', 'abc123')).toBe('https://campinity-app.vercel.app/post/abc123')
    expect(getShareUrl('profile', 'kabir')).toBe('https://campinity-app.vercel.app/student/kabir')
  })
  test('unknown types give no URL rather than a broken one', () => {
    expect(getShareUrl('nonsense', 'x')).toBeNull()
  })
})

describe('copyText only reports success when the copy happened', () => {
  test('clipboard API success', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } })
    await expect(copyText('hi')).resolves.toBe(true)
  })
  test('clipboard denied and legacy copy unavailable -> false', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } })
    document.execCommand = vi.fn(() => false)
    await expect(copyText('hi')).resolves.toBe(false)
  })
  test('clipboard denied but legacy copy works -> true', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } })
    document.execCommand = vi.fn(() => true)
    await expect(copyText('hi')).resolves.toBe(true)
  })
})

describe('nativeShare outcomes', () => {
  const args = { title: 'Post', text: 'Post', url: 'https://campinity-app.vercel.app/post/1' }
  test('Android: Capacitor Share success', async () => {
    native.isNative = true
    native.shareImpl = vi.fn(async () => ({}))
    await expect(nativeShare(args)).resolves.toEqual({ ok: true })
    expect(native.shareImpl).toHaveBeenCalledWith(expect.objectContaining({ url: args.url }))
  })
  test('Android: user cancelled is not success and not an error', async () => {
    native.isNative = true
    native.shareImpl = async () => Promise.reject(new Error('Share canceled'))
    await expect(nativeShare(args)).resolves.toEqual({ cancelled: true })
  })
  test('Android: real failure is reported', async () => {
    native.isNative = true
    native.shareImpl = async () => Promise.reject(new Error('No activity found'))
    await expect(nativeShare(args)).resolves.toMatchObject({ error: 'No activity found' })
  })
  test('browser without Web Share API -> unsupported', async () => {
    await expect(nativeShare(args)).resolves.toEqual({ unsupported: true })
  })
  test('browser Web Share abort -> cancelled', async () => {
    navigator.share = async () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }))
    await expect(nativeShare(args)).resolves.toEqual({ cancelled: true })
  })
  test('invalid links are refused', async () => {
    await expect(nativeShare({ ...args, url: 'http://' })).resolves.toEqual({ error: 'Invalid link' })
    await expect(nativeShare({ ...args, url: 'https://localhost/post/1' })).resolves.toEqual({ error: 'Invalid link' })
    await expect(nativeShare({ ...args, url: 'capacitor://localhost/post/1' })).resolves.toEqual({ error: 'Invalid link' })
  })
})
