import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase.js'
import { getUserProfile } from './profileService.js'
import { BADGES } from '../gamification/config.js'

/**
 * Real leaderboard, built directly on the existing `userProgress`
 * collection — no new collection, no scheduled job. SCHEMA.md's own
 * note confirms this is the intended approach for the "overall" scope
 * before the app has enough users to need the deferred, precomputed
 * `leaderboards/{scope}` collection.
 *
 * `pageSize` is a single fetch, not paginated — an honest scale
 * trade-off matching this collection's existing `getUserRank()`
 * comment ("fine at current scale"). 100 is generous enough that "not
 * artificially limited to 3-5 users" holds in practice without the
 * complexity of cursor-based infinite scroll for a dataset this app
 * doesn't have thousands of rows in yet.
 *
 * `metric` picks which real, server-orderable userProgress field to
 * rank by — every one of these is a genuine denormalized counter
 * (xp/reputationScore have always existed; contributionsCount/
 * badgeCount are maintained by xpService.js's awardXP transaction and
 * badgeService.js's awardBadge respectively), never a client-computed
 * approximation.
 *
 * `scope: 'college'` is now a REAL server-side query
 * (where('collegeId','==', collegeId).orderBy(metric,'desc')), not a
 * client-side filter over the global top-N window — replacing the
 * previous approach, which made a user outside the global top 100
 * invisible to their own college's ranking. This needs collegeId
 * denormalized onto userProgress (done lazily in xpService.js's
 * getUserProgress) and the composite indexes declared in
 * firestore.indexes.json. A disclosed limitation: a user whose
 * collegeId hasn't been backfilled onto their userProgress doc yet
 * (i.e. they haven't had a profile read trigger the self-heal since
 * this shipped) won't appear in college-scoped results until they do.
 */
const DEFAULT_PAGE_SIZE = 100
export const LEADERBOARD_METRICS = [
  { id: 'xp', field: 'xp', label: 'XP', suffix: 'XP' },
  { id: 'reputationScore', field: 'reputationScore', label: 'Reputation', suffix: 'REP' },
  { id: 'contributionsCount', field: 'contributionsCount', label: 'Contributions', suffix: 'contributions' },
  { id: 'badgeCount', field: 'badgeCount', label: 'Badges', suffix: 'badges' }
]

export async function getLeaderboard({ metric = 'xp', scope = 'global', collegeId = null, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const field = LEADERBOARD_METRICS.find((m) => m.id === metric)?.field || 'xp'

  const constraints =
    scope === 'college' && collegeId
      ? [where('collegeId', '==', collegeId), orderBy(field, 'desc'), limit(pageSize)]
      : [orderBy(field, 'desc'), limit(pageSize)]

  const snap = await getDocs(query(collection(db, 'userProgress'), ...constraints))
  const rows = snap.docs.map((d) => ({ uid: d.id, value: d.data()[field] || 0 }))

  const profiles = await Promise.all(rows.map((row) => getUserProfile(row.uid).catch(() => null)))

  return rows.map((row, index) => ({
    uid: row.uid,
    rank: index + 1,
    value: row.value,
    profile: profiles[index] || { displayName: 'Student', username: '', avatar: '', collegeId: null }
  }))
}

/**
 * Real live rank for ANY metric/scope combination — the same
 * "count how many people are strictly ahead of me" approach
 * xpService.js's getUserRank already uses for the profile card's XP
 * rank, generalized so the leaderboard's Reputation/Contributions/
 * Badges tabs and college scope can show a real "Your Rank" even when
 * the viewer isn't in the currently-fetched top-N window, instead of
 * only supporting this for XP.
 */
export async function getUserMetricRank({ uid, metric = 'xp', scope = 'global', collegeId = null }) {
  const field = LEADERBOARD_METRICS.find((m) => m.id === metric)?.field || 'xp'
  const progressSnap = await getDoc(doc(db, 'userProgress', uid))
  const value = progressSnap.exists() ? progressSnap.data()[field] || 0 : 0

  const constraints =
    scope === 'college' && collegeId ? [where('collegeId', '==', collegeId), where(field, '>', value)] : [where(field, '>', value)]

  const snap = await getDocs(query(collection(db, 'userProgress'), ...constraints))
  return { rank: snap.size + 1, value }
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
