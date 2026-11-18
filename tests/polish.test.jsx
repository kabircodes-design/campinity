// Presence wording, the Profile photo-post mapper fix, and Radar
// visibility filtering. Firebase is mocked; no network.
import { describe, expect, test, vi } from 'vitest'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const radarMocks = vi.hoisted(() => ({ profiles: {} }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: { uid: 'me' } }, db: {}, storage: {}, default: {} }))
vi.mock(`${SRC}/firebase/profileService.js`, async (orig) => ({
  ...(await orig()),
  getUserProfile: async (uid) => radarMocks.profiles[uid] || null,
  getMutualFollowers: async () => [],
  getFollowingSet: async () => new Set()
}))
vi.mock(`${SRC}/firebase/communityService.js`, () => ({ getUserCommunityMemberships: async () => [] }))
vi.mock(`${SRC}/firebase/blockService.js`, () => ({ getBlockedUsers: async () => [{ blockedUid: 'blocked' }] }))
vi.mock('firebase/firestore', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    collection: () => ({}),
    query: () => ({}),
    where: () => ({}),
    limit: () => ({}),
    getDocs: async () => ({
      docs: ['me', 'visible', 'hidden', 'blocked', 'legacy'].map((id) => ({ id }))
    })
  }
})

const { formatPresence } = await import(`${SRC}/firebase/presenceService.js`)
const { mapPostDoc } = await import(`${SRC}/firebase/postService.js`)
const { getRadarResults } = await import(`${SRC}/radar/radarService.js`)

describe('formatPresence', () => {
  const now = new Date(2026, 10, 14, 15, 0, 0).getTime() // 14 Nov 2026, 15:00 local
  const ago = (ms) => now - ms
  test('no data shows nothing rather than a guess', () => {
    expect(formatPresence(null, now)).toEqual({ online: false, label: null })
  })
  test('active within the heartbeat window is online', () => {
    expect(formatPresence(ago(20_000), now)).toEqual({ online: true, label: 'Active now' })
  })
  test('ages out on its own: recently, minutes, today, yesterday, weekday, date', () => {
    expect(formatPresence(ago(2 * 60_000), now).label).toBe('Active recently')
    expect(formatPresence(ago(12 * 60_000), now).label).toBe('Active 12 min ago')
    expect(formatPresence(ago(3 * 3600_000), now).label).toBe('Active today')
    expect(formatPresence(new Date(2026, 10, 13, 22, 0).getTime(), now).label).toBe('Active yesterday')
    expect(formatPresence(new Date(2026, 10, 10, 9, 0).getTime(), now).label).toMatch(/^Active \S+$/)
    expect(formatPresence(new Date(2026, 9, 1, 9, 0).getTime(), now).label).toMatch(/^Active /)
    expect(formatPresence(ago(60_000), now).online).toBe(false)
  })
})

describe('mapPostDoc (Profile posts, community feeds, search)', () => {
  const snap = (data) => ({ id: 'p1', data: () => data })
  test('a photo post exposes the image under the name PostCard renders (imageUrl)', () => {
    const post = mapPostDoc(snap({ userId: 'u1', text: 'Sunset', image: 'https://img/x.jpg' }), 'u1')
    expect(post.imageUrl).toBe('https://img/x.jpg')
    expect(post.imagePreviewUrl).toBe('https://img/x.jpg') // grid / photo views keep working
    expect(post.text).toBe('Sunset')
  })
  test('text-only posts have no image fields', () => {
    const post = mapPostDoc(snap({ userId: 'u1', text: 'Hello', image: null }), 'u1')
    expect(post.imageUrl).toBeUndefined()
    expect(post.imagePreviewUrl).toBeUndefined()
  })
})

describe('Radar visibility', () => {
  test('people who chose Hidden, and people you blocked, never appear; absent preference = visible', async () => {
    radarMocks.profiles = {
      visible: { displayName: 'Visible', collegeId: 'c1', radarVisible: true },
      hidden: { displayName: 'Hidden', collegeId: 'c1', radarVisible: false },
      blocked: { displayName: 'Blocked', collegeId: 'c1' },
      legacy: { displayName: 'Never set', collegeId: 'c1' }
    }
    const results = await getRadarResults('me', { collegeId: 'c1' }, null)
    expect(results.map((r) => r.displayName).sort()).toEqual(['Never set', 'Visible'])
  })
})
