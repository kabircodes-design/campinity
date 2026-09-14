import { collection, getCountFromServer, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from './firebase.js'
import { getUserProfile } from './profileService.js'
import { BADGES } from '../gamification/config.js'

/**
 * Real leaderboard, built directly on the existing `userProgress`
 * collection — no new collection, no scheduled job. SCHEMA.md's own
 * note confirms this is the intended approach for the "overall" scope
 * before the app has enough users to need the deferred, precomputed
 * `leaderboards/{scope}` collection: `orderBy('xp','desc')` directly on
 * `userProgress`, which every user can already read (see firestore.rules
 * — `allow read: if isSignedIn()` on both `userProgress` and `users`).
 *
 * `pageSize` is a single fetch, not paginated — an honest scale
 * trade-off matching this collection's existing `getUserRank()`
 * comment ("fine at current scale"). 100 is generous enough that "not
 * artificially limited to 3-5 users" holds in practice without the
 * complexity of cursor-based infinite scroll for a dataset this app
 * doesn't have thousands of rows in yet.
 */
const DEFAULT_PAGE_SIZE = 100

export async function getLeaderboard({ pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const snap = await getDocs(query(collection(db, 'userProgress'), orderBy('xp', 'desc'), limit(pageSize)))
  const rows = snap.docs.map((d) => ({ uid: d.id, xp: d.data().xp || 0 }))

  const profiles = await Promise.all(rows.map((row) => getUserProfile(row.uid).catch(() => null)))

  return rows.map((row, index) => ({
    uid: row.uid,
    rank: index + 1,
    xp: row.xp,
    profile: profiles[index] || { displayName: 'Student', username: '', avatar: '', collegeId: null }
  }))
}

/**
 * Total ranked users — a real Firestore count aggregation (one minimal
 * read, not a full document fetch), used for "Top X%" on the profile
 * card. This is the only "rank movement"-style stat this schema can
 * honestly support: there's no stored rank history to compute "up 3
 * places this week" from, so that specific metric (mentioned as an
 * EXAMPLE in the brief, not a requirement) is intentionally not shown.
 */
export async function getLeaderboardUserCount() {
  const snap = await getCountFromServer(collection(db, 'userProgress'))
  return snap.data().count
}

/**
 * Most recently earned badge for a handful of uids (the podium only —
 * calling this per leaderboard row would be an unbounded N+1). Returns
 * a Map<uid, { badgeId, label, emoji } | null>.
 */
export async function getLatestBadges(uids) {
  const results = await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDocs(collection(db, 'userBadges', uid, 'earned'))
        if (snap.empty) return [uid, null]
        let latest = null
        snap.forEach((d) => {
          const data = d.data()
          const ms = data.earnedAt?.toMillis ? data.earnedAt.toMillis() : 0
          if (!latest || ms > latest.ms) latest = { ms, badgeId: data.badgeId || d.id }
        })
        const meta = latest && BADGES[latest.badgeId]
        return [uid, meta ? { badgeId: latest.badgeId, label: meta.label, emoji: meta.emoji } : null]
      } catch {
        return [uid, null]
      }
    })
  )
  return new Map(results)
}
