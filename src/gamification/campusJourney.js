import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { ACTIVITY_LABELS, BADGES } from './config.js'

/**
 * "Your Campus Journey" — built ENTIRELY from real, already-timestamped
 * records this app already writes (account creation, first-of-type
 * xpLog entries, earned badges, level-up notifications, verified
 * achievements). No historical event is invented: a user who joined
 * before any of this shipped will simply have a shorter journey (their
 * account-creation date plus whatever real activity already exists in
 * xpLog/userBadges/notifications), never a fabricated one.
 */
const MILESTONE_ACTIVITY_TYPES = ['post_created', 'notes_uploaded', 'comment_created', 'club_joined', 'story_uploaded', 'lostfound_resolved']

async function firstEntryOfType(uid, activityType) {
  const snap = await getDocs(
    query(collection(db, 'xpLog', uid, 'entries'), where('activityType', '==', activityType), orderBy('createdAt', 'asc'), limit(1))
  )
  return snap.empty ? null : snap.docs[0].data()
}

export async function getCampusJourney(uid) {
  const events = []

  const [userSnap, badgesSnap, levelUpsSnap, verifiedSnap, ...firsts] = await Promise.all([
    getDoc(doc(db, 'users', uid)).catch(() => null),
    getDocs(collection(db, 'userBadges', uid, 'earned')).catch(() => null),
    getDocs(query(collection(db, 'users', uid, 'notifications'), where('type', '==', 'level_up'))).catch(() => null),
    getDocs(collection(db, 'users', uid, 'verifiedAchievements')).catch(() => null),
    ...MILESTONE_ACTIVITY_TYPES.map((type) => firstEntryOfType(uid, type))
  ])

  const createdAt = userSnap?.exists?.() ? userSnap.data()?.createdAt : null
  if (createdAt) events.push({ ts: createdAt, icon: '🎓', label: 'You joined Campinity' })

  MILESTONE_ACTIVITY_TYPES.forEach((type, i) => {
    const entry = firsts[i]
    if (entry?.createdAt) events.push({ ts: entry.createdAt, icon: '✨', label: `First time: ${ACTIVITY_LABELS[type] || type}` })
  })

  badgesSnap?.forEach((d) => {
    const data = d.data()
    const badge = BADGES[data.badgeId]
    if (badge && data.earnedAt) events.push({ ts: data.earnedAt, icon: badge.emoji, label: `You earned ${badge.label}` })
  })

  levelUpsSnap?.forEach((d) => {
    const data = d.data()
    if (data.createdAt) events.push({ ts: data.createdAt, icon: '⭐', label: `You reached Level ${data.newLevel}` })
  })

  verifiedSnap?.forEach((d) => {
    const data = d.data()
    if (data.earnedAt) events.push({ ts: data.earnedAt, icon: '🏆', label: `Verified achievement: ${data.title}` })
  })

  return events
    .filter((e) => e.ts?.toMillis)
    .sort((a, b) => a.ts.toMillis() - b.ts.toMillis())
    .slice(0, 12)
}
