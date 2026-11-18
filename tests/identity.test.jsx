// Regression tests for the "active accounts show Student" bug.
// Covers: active, fullName-only (onboarding) profiles, deleted, suspended,
// missing profile, loading and failed-fetch scenarios — at the resolver,
// the shared author cache, and the feed post mapper.
import { beforeEach, describe, expect, test, vi } from 'vitest'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({ profiles: {}, fail: new Set(), calls: [] }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: null }, db: {}, storage: {}, googleProvider: {}, default: {} }))
vi.mock(`${SRC}/firebase/profileService.js`, () => ({
  getUserProfile: async (uid) => {
    m.calls.push(uid)
    if (m.fail.has(uid)) throw Object.assign(new Error('unavailable'), { code: 'unavailable' })
    return uid in m.profiles ? m.profiles[uid] : null
  }
}))

const identity = await import(`${SRC}/identity/identity.js`)
const cache = await import(`${SRC}/hooks/useAuthorEnrichment.js`)
const { mapPostForCard } = await import(`${SRC}/hooks/postFeedShared.js`)

beforeEach(() => {
  m.profiles = {}
  m.fail = new Set()
  m.calls = []
  cache._resetAuthorCacheForTests()
  vi.useRealTimers()
})

describe('resolveIdentity — display policy', () => {
  const { resolveIdentity, displayNameOf, normalizeUserDoc } = identity
  test('active: displayName, else fullName (onboarding), else @username', () => {
    expect(displayNameOf({ displayName: 'Asha Rao', fullName: 'X' })).toBe('Asha Rao')
    expect(displayNameOf({ fullName: 'Kabir Saiyed', username: 'kabir' })).toBe('Kabir Saiyed')
    expect(displayNameOf({ displayName: '   ', fullName: 'Kabir Saiyed' })).toBe('Kabir Saiyed')
    expect(displayNameOf({ username: 'kabir' })).toBe('@kabir')
  })
  test('active with no name anywhere uses the content snapshot, Student only as last resort', () => {
    expect(resolveIdentity({}, { name: 'From Post' }).name).toBe('From Post')
    expect(resolveIdentity({}).name).toBe('Student')
  })
  test('deleted (null / status deleted) and suspended -> Student, hidden, no username', () => {
    for (const p of [null, { status: 'deleted' }, { moderationStatus: 'suspended', displayName: 'Real Name', username: 'real' }]) {
      const r = resolveIdentity(p, { name: 'Snapshot', username: 'snap' })
      expect(r).toMatchObject({ name: 'Student', username: '', hidden: true })
    }
  })
  test('restricted accounts still show their name', () => {
    expect(displayNameOf({ displayName: 'Asha', moderationStatus: 'restricted' })).toBe('Asha')
  })
  test('loading (undefined) and failed lookups NEVER become Student — snapshot or empty', () => {
    expect(resolveIdentity(undefined, { name: 'Kabir Saiyed' })).toMatchObject({ name: 'Kabir Saiyed', status: 'loading', hidden: false })
    expect(resolveIdentity({ status: 'unavailable' }, { name: 'Kabir Saiyed' })).toMatchObject({ name: 'Kabir Saiyed', status: 'unavailable' })
    expect(resolveIdentity(undefined).name).toBe('')
    expect(resolveIdentity({ status: 'unavailable' }).name).toBe('')
  })
  test('normalizeUserDoc adds displayName from fullName without mutating', () => {
    const raw = { fullName: 'Kabir Saiyed', username: 'kabir' }
    expect(normalizeUserDoc(raw).displayName).toBe('Kabir Saiyed')
    expect(raw.displayName).toBeUndefined()
    expect(normalizeUserDoc(null)).toBeNull()
  })
})

describe('shared author cache (useAuthorEnrichment)', () => {
  test('active profile resolves its real name (fullName-only profiles included)', async () => {
    m.profiles.u1 = { fullName: 'Kabir Saiyed', username: 'kabir', avatar: 'a.png' }
    const map = await cache.getProfilesByUids(['u1'])
    expect(map.get('u1')).toMatchObject({ status: 'active', displayName: 'Kabir Saiyed', username: 'kabir' })
  })
  test('missing users/{uid} doc = deleted -> Student, no photo/username', async () => {
    const map = await cache.getProfilesByUids(['gone'])
    expect(map.get('gone')).toMatchObject({ status: 'deleted', displayName: 'Student', username: '', avatar: '' })
  })
  test('suspended account -> Student, no photo/username', async () => {
    m.profiles.s1 = { displayName: 'Banned Person', username: 'banned', avatar: 'x.png', moderationStatus: 'suspended' }
    const map = await cache.getProfilesByUids(['s1'])
    expect(map.get('s1')).toMatchObject({ status: 'suspended', displayName: 'Student', username: '', avatar: '' })
  })
  test('a FAILED fetch is not cached as deleted and is retried after the backoff', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    m.fail.add('u2')
    m.profiles.u2 = { displayName: 'Asha Rao' }
    expect((await cache.getProfilesByUids(['u2'])).get('u2')).toMatchObject({ status: 'unavailable', displayName: '' })
    // within backoff: no request storm
    expect((await cache.getProfilesByUids(['u2'])).get('u2').status).toBe('unavailable')
    expect(m.calls.filter((c) => c === 'u2')).toHaveLength(1)
    // network recovers; after backoff the real name appears
    m.fail.delete('u2')
    vi.setSystemTime(Date.now() + 31_000)
    expect((await cache.getProfilesByUids(['u2'])).get('u2')).toMatchObject({ status: 'active', displayName: 'Asha Rao' })
  })
  test('primeAuthorCache with the raw signed-in doc (fullName only) — the original bug', async () => {
    cache.primeAuthorCache('me', { fullName: 'Kabir Saiyed', username: 'kabir', avatar: 'me.png' })
    const map = await cache.getProfilesByUids(['me'])
    expect(map.get('me')).toMatchObject({ status: 'active', displayName: 'Kabir Saiyed', username: 'kabir' })
    expect(m.calls).toEqual([]) // served from the primed cache
  })
  test('enrichWithAuthors gives items without a uid the unavailable profile (keeps stored name)', async () => {
    const out = await cache.enrichWithAuthors([{ id: 'a' }], () => null, (item, p) => ({ ...item, p }))
    expect(out[0].p.status).toBe('unavailable')
  })
})

describe('feed post mapping (mapPostForCard)', () => {
  const raw = (over = {}) => ({ id: 'p1', userId: 'u1', text: 'hi', displayName: 'Kabir Saiyed', username: 'kabir', createdAt: null, ...over })
  test('active author: live name, avatar and verified badge', () => {
    const card = mapPostForCard(raw(), 'me', { status: 'active', displayName: 'Kabir S.', username: 'kabir', avatar: 'a.png', avatarMode: 'photo', verifiedCampus: true })
    expect(card).toMatchObject({ name: 'Kabir S.', username: 'kabir', verified: true })
  })
  test('loading / failed lookup: the name stored on the post, not Student', () => {
    expect(mapPostForCard(raw(), 'me', undefined).name).toBe('Kabir Saiyed')
    expect(mapPostForCard(raw(), 'me', cache.UNAVAILABLE_PROFILE).name).toBe('Kabir Saiyed')
  })
  test('deleted or suspended author: Student, no avatar, no badge, no username', () => {
    for (const p of [{ status: 'deleted', displayName: 'Student' }, { status: 'suspended', displayName: 'Student' }]) {
      const card = mapPostForCard(raw(), 'me', p)
      expect(card).toMatchObject({ name: 'Student', username: '', avatarUrl: '', verified: false })
    }
  })
  test('anonymous posts never reveal identity', () => {
    const card = mapPostForCard(raw({ isAnonymous: true }), 'me', { status: 'active', displayName: 'Real', verifiedCampus: true })
    expect(card).toMatchObject({ name: 'Anonymous', username: '', avatarUrl: '', verified: false })
  })
})
