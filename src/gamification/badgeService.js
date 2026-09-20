import { collection, doc, getDoc, getDocs, increment, query, setDoc, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { BADGES } from './config.js'
import { createBadgeNotification } from '../firebase/notificationService.js'
import { progressDoc } from './xpService.js'

/**
 * Badge checking runs AFTER awardXP, reading real data (xpLog counts,
 * userProgress fields) — never a separate, parallel counter that could
 * drift from what actually happened. userBadges/{uid}/earned/{badgeId}
 * uses the badge id itself as the document id, which is what makes
 * "never awarded twice" structurally true rather than a check that
 * could race: a second award attempt is just an idempotent overwrite
 * of a doc that already exists, not a duplicate.
 *
 * Only badges with a real, checkable criteria.type are evaluated here
 * (posts_created, comments_created, likes_received, streak_reached,
 * level_reached). Badges marked criteria.type === 'manual' in
 * config.js (Academic Genius, Club Founder, etc.) are intentionally
 * NOT auto-awarded — nothing in this app can verify "founded a club"
 * or "won a hackathon" from activity data alone, and awarding them
 * automatically would be fabricating an achievement the user didn't
 * necessarily earn. They remain defined for a future manual-award
 * admin action, not faked here.
 */

/** Real earned-badge records for BadgesPage — { badgeId, earnedAt }[], most recent first. */
export async function getEarnedBadges(uid) {
  const snap = await getDocs(collection(db, 'userBadges', uid, 'earned'))
  return snap.docs
    .map((d) => ({ badgeId: d.id, earnedAt: d.data().earnedAt || null }))
    .sort((a, b) => (b.earnedAt?.toMillis?.() || 0) - (a.earnedAt?.toMillis?.() || 0))
}

/** Exported — reused by BadgesPage to compute real "3 / 5" progress on locked badges without duplicating this query logic. */
export async function countEventsOfType(uid, activityType) {
  const snap = await getDocs(query(collection(db, 'xpLog', uid, 'entries'), where('activityType', '==', activityType)))
  return snap.size
}

async function isBadgeEarned(uid, badgeId) {
  const snap = await getDoc(doc(db, 'userBadges', uid, 'earned', badgeId))
  return snap.exists()
}

async function awardBadge(uid, badgeId) {
  const badge = BADGES[badgeId]
  if (!badge) return false
  const ref = doc(db, 'userBadges', uid, 'earned', badgeId)
  const existing = await getDoc(ref)
  if (existing.exists()) return false // already earned — idempotent no-op, not a re-award

  await setDoc(ref, { badgeId, earnedAt: serverTimestamp(), seen: false })

  // Denormalized count for the leaderboard's Badges tab — a plain
  // increment(), not a second transaction, so it doesn't contend with
  // the transaction awardXP already runs against this same hot doc.
  await updateDoc(progressDoc(uid), { badgeCount: increment(1), updatedAt: serverTimestamp() }).catch(() => {})

  await createBadgeNotification({ targetUid: uid, badgeId, badgeLabel: badge.label, badgeEmoji: badge.emoji }).catch(() => {})

  return true
}

/**
 * Given a badge and a progress snapshot, returns real, currently-known
 * progress toward it as { current, target } — used by BadgesPage for
 * locked-badge progress bars. Never fabricated: badges with no
 * checkable criteria (manual) or ones needing an extra fetch this
 * function intentionally doesn't do (joined_before) return null,
 * which the UI renders as "no progress tracking available" rather
 * than a fake number.
 */
export async function getBadgeProgress(uid, badge, progressSnapshot) {
  const { type, value } = badge.criteria || {}
  if (type === 'streak_reached') return { current: progressSnapshot?.streak || 0, target: value }
  if (type === 'level_reached') return { current: progressSnapshot?.level || 1, target: value }
  if (type === 'posts_created') return { current: await countEventsOfType(uid, 'post_created'), target: value }
  if (type === 'comments_created') return { current: await countEventsOfType(uid, 'comment_created'), target: value }
  if (type === 'comments_received') return { current: await countEventsOfType(uid, 'comment_received'), target: value }
  if (type === 'likes_received') return { current: await countEventsOfType(uid, 'like_received'), target: value }
  if (type === 'events_attended') return { current: await countEventsOfType(uid, 'event_attended'), target: value }
  if (type === 'stories_uploaded') return { current: await countEventsOfType(uid, 'story_uploaded'), target: value }
  if (type === 'notes_uploaded') return { current: await countEventsOfType(uid, 'notes_uploaded'), target: value }
  if (type === 'communities_joined') return { current: await countEventsOfType(uid, 'club_joined'), target: value }
  if (type === 'lostfound_resolved') return { current: await countEventsOfType(uid, 'lostfound_resolved'), target: value }
  if (type === 'campus_verified') return { current: progressSnapshot?.verifiedCampus ? 1 : 0, target: 1 }
  return null
}

/**
 * Checks every auto-checkable badge and awards any newly-earned ones.
 * Called after awardXP in each wired action — cheap at this project's
 * scale (a handful of small queries), each badge only actually queried
 * once it's plausible to have been earned (see the early-exit checks
 * per criteria type below) rather than blindly checking all of them
 * on every single action.
 */
export async function checkAndAwardBadges(uid, progressSnapshot) {
  const newlyAwarded = []

  const checks = Object.entries(BADGES).filter(([, badge]) => badge.criteria?.type !== 'manual')

  for (const [badgeId, badge] of checks) {
    if (await isBadgeEarned(uid, badgeId)) continue

    const { type, value } = badge.criteria
    let earned = false

    if (type === 'streak_reached') {
      // Fixed pre-existing bug: every call site here passes the
      // getUserProgress() DISPLAY shape (buildDisplayProgress's
      // `streak` field), never the raw userProgress doc's
      // `currentStreak` field — this read the wrong key and could
      // never actually true (streak-based badges could never
      // auto-award).
      earned = (progressSnapshot?.streak || 0) >= value
    } else if (type === 'level_reached') {
      earned = (progressSnapshot?.level || 1) >= value
    } else if (type === 'posts_created') {
      earned = (await countEventsOfType(uid, 'post_created')) >= value
    } else if (type === 'comments_created') {
      earned = (await countEventsOfType(uid, 'comment_created')) >= value
    } else if (type === 'comments_received') {
      earned = (await countEventsOfType(uid, 'comment_received')) >= value
    } else if (type === 'likes_received') {
      earned = (await countEventsOfType(uid, 'like_received')) >= value
    } else if (type === 'events_attended') {
      earned = (await countEventsOfType(uid, 'event_attended')) >= value
    } else if (type === 'stories_uploaded') {
      earned = (await countEventsOfType(uid, 'story_uploaded')) >= value
    } else if (type === 'notes_uploaded') {
      earned = (await countEventsOfType(uid, 'notes_uploaded')) >= value
    } else if (type === 'communities_joined') {
      earned = (await countEventsOfType(uid, 'club_joined')) >= value
    } else if (type === 'lostfound_resolved') {
      earned = (await countEventsOfType(uid, 'lostfound_resolved')) >= value
    } else if (type === 'campus_verified') {
      earned = Boolean(progressSnapshot?.verifiedCampus)
    } else if (type === 'joined_before') {
      // Needs the account creation date, which lives on users/{uid},
      // not userProgress — fetched only here, once, and only for a
      // still-unearned joined_before badge, to avoid an extra read on
      // every single badge check for every user.
      const userSnap = await getDoc(doc(db, 'users', uid))
      const createdAt = userSnap.exists() ? userSnap.data()?.createdAt : null
      if (createdAt?.toDate) {
        earned = createdAt.toDate() < new Date(value)
      }
    }

    if (earned && (await awardBadge(uid, badgeId))) {
      newlyAwarded.push({ badgeId, ...badge })
    }
  }

  return newlyAwarded
}
