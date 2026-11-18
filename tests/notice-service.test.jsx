// Notice Board client service — the query the Firestore rules depend on,
// the clock-skew retry, and "never expires" handling. Firestore is mocked;
// the real rules are exercised in rules/notices.emulator.test.mjs.
import { beforeEach, describe, expect, test, vi } from 'vitest'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({ queries: [], respond: null }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: {}, db: {}, storage: {}, googleProvider: {}, default: {} }))
vi.mock('firebase/firestore', async (orig) => {
  const real = await orig()
  return {
    ...real,
    collection: (_db, ...p) => ({ path: p.join('/') }),
    where: (field, op, value) => ({ kind: 'where', field, op, value }),
    orderBy: (field, dir) => ({ kind: 'orderBy', field, dir }),
    limit: (n) => ({ kind: 'limit', n }),
    query: (col, ...parts) => ({ col, parts }),
    getDocs: async (q) => {
      m.queries.push(q)
      return m.respond(q)
    }
  }
})

const svc = await import(`${SRC}/notices/noticeService.js`)
const { Timestamp } = await import('firebase/firestore')

const keyOf = (q) => q.parts.find((p) => p.field === 'audienceKeys').value
const bound = (q, field) => q.parts.find((p) => p.field === field)
const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' })
const snap = (docs) => ({ docs: docs.map((d) => ({ id: d.id, data: () => d })) })
const delivery = (over) => ({ id: 'g1__all', groupId: 'g1', title: 'T', body: 'B', priority: 'normal', publishAt: Timestamp.fromMillis(Date.now() - 3600_000), expiresAt: Timestamp.fromMillis(Date.UTC(9999, 0, 1)), ...over })

beforeEach(() => {
  m.queries = []
  m.respond = () => snap([])
})

describe('board query shape (what the read rule requires)', () => {
  test('bounds publishAt from above and expiresAt from below around "now" by the margin', () => {
    const now = Date.UTC(2026, 10, 18, 12)
    const q = svc.boardQuery({}, 'all', now, 60_000)
    expect(q.col.path).toBe('notices')
    expect(bound(q, 'audienceKeys')).toMatchObject({ op: 'array-contains', value: 'all' })
    expect(bound(q, 'publishAt').op).toBe('<=')
    expect(bound(q, 'publishAt').value.toMillis()).toBe(now - 60_000)
    expect(bound(q, 'expiresAt').op).toBe('>')
    expect(bound(q, 'expiresAt').value.toMillis()).toBe(now + 60_000)
    expect(q.parts).toContainEqual({ kind: 'orderBy', field: 'publishAt', dir: 'desc' })
    expect(q.parts).toContainEqual({ kind: 'limit', n: 20 })
  })

  test('runs one query per audience key: everyone, own uid, own campus', async () => {
    await svc.fetchMyNotices({ uid: 'u1', collegeId: 'c1' })
    expect(m.queries.map(keyOf).sort()).toEqual(['all', 'college:c1', 'uid:u1'])
  })
})

describe('clock-skew retry', () => {
  test('a permission-denied query is retried once with the wider margin, then succeeds', async () => {
    m.respond = (q) => {
      const margin = bound(q, 'expiresAt').value.toMillis() - Date.now()
      if (margin < 5 * 60_000) throw denied()
      return snap(keyOf(q) === 'all' ? [delivery()] : [])
    }
    const list = await svc.fetchMyNotices({ uid: 'u1', collegeId: null })
    expect(list.map((n) => n.groupId)).toEqual(['g1'])
    expect(m.queries).toHaveLength(4) // 2 keys × (1 denied + 1 retry)
  })

  test('non-permission errors are not retried', async () => {
    m.respond = () => {
      throw Object.assign(new Error('offline'), { code: 'unavailable' })
    }
    await expect(svc.fetchMyNotices({ uid: 'u1' })).rejects.toMatchObject({ code: 'unavailable' })
    expect(m.queries).toHaveLength(2)
  })

  test('one audience failing does not blank the board; all failing surfaces the error', async () => {
    m.respond = (q) => {
      if (keyOf(q) === 'college:c9') throw denied()
      return snap(keyOf(q) === 'all' ? [delivery()] : [])
    }
    expect((await svc.fetchMyNotices({ uid: 'u1', collegeId: 'c9' })).map((n) => n.groupId)).toEqual(['g1'])
    m.respond = () => {
      throw denied()
    }
    await expect(svc.fetchMyNotices({ uid: 'u1' })).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

describe('never-expires sentinel', () => {
  test('year-9999 expiry is presented as "no expiry"; real expiries are kept', () => {
    expect(svc.toNotice('a', delivery()).expiresAtMs).toBeNull()
    const real = Date.now() + 86400_000
    expect(svc.toNotice('b', delivery({ expiresAt: Timestamp.fromMillis(real) })).expiresAtMs).toBe(real)
    expect(svc.toNotice('c', delivery({ expiresAt: null })).expiresAtMs).toBeNull()
  })

  test('arrangeNotices still drops scheduled and expired items as a second line of defence', () => {
    const now = Date.now()
    const list = svc.arrangeNotices(
      [
        svc.toNotice('live', delivery({ groupId: 'live' })),
        svc.toNotice('soon', delivery({ groupId: 'soon', publishAt: Timestamp.fromMillis(now + 60_000) })),
        svc.toNotice('gone', delivery({ groupId: 'gone', expiresAt: Timestamp.fromMillis(now - 1) }))
      ],
      now
    )
    expect(list.map((n) => n.groupId)).toEqual(['live'])
  })
})

describe('admin callable: undeployed functions get an actionable message', () => {
  test('not-found / bare internal become "not deployed"; auth errors untouched', async () => {
    const { explainMissingFunction } = await import(`${SRC}/admin/services/adminCallable.js`)
    const nf = explainMissingFunction('adminListNotices', Object.assign(new Error('not-found'), { code: 'functions/not-found' }))
    expect(nf).toMatchObject({ notDeployed: true, message: expect.stringMatching(/adminListNotices is not deployed/) })
    expect(explainMissingFunction('x', Object.assign(new Error('internal'), { code: 'functions/internal' })).notDeployed).toBe(true)
    const auth = Object.assign(new Error('Device proof required.'), { code: 'functions/unauthenticated' })
    expect(explainMissingFunction('x', auth)).toBe(auth)
    const real = Object.assign(new Error('Could not save the notice.'), { code: 'functions/internal' })
    expect(explainMissingFunction('x', real)).toBe(real)
  })
})
