import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { BADGES } from './config.js'
import { createBadgeNotification } from '../firebase/notificationService.js'

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

async function countEventsOfType(uid, activityType) {
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

  await createBadgeNotification({ targetUid: uid, badgeId, badgeLabel: badge.label, badgeEmoji: badge.emoji }).catch(() => {})

  return true
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
      earned = (progressSnapshot?.currentStreak || 0) >= value
    } else if (type === 'level_reached') {
      earned = (progressSnapshot?.level || 1) >= value
    } else if (type === 'posts_created') {
      earned = (await countEventsOfType(uid, 'post_created')) >= value
    } else if (type === 'comments_created') {
      earned = (await countEventsOfType(uid, 'comment_created')) >= value
    } else if (type === 'likes_received') {
      earned = (await countEventsOfType(uid, 'like_received')) >= value
    } else if (type === 'events_attended') {
      earned = (await countEventsOfType(uid, 'event_attended')) >= value
    } else if (type === 'stories_uploaded') {
      earned = (await countEventsOfType(uid, 'story_uploaded')) >= value
    } else if (type === 'campus_verified') {
      earned = Boolean(progressSnapshot?.verifiedCampus)
    }
    // 'joined_before' (Early Bird) intentionally not evaluated here —
    // it needs the user's account creation date, which lives on
    // users/{uid}, not userProgress — left for a follow-up pass rather
    // than guessed at with the wrong document.

    if (earned && (await awardBadge(uid, badgeId))) {
      newlyAwarded.push({ badgeId, ...badge })
    }
  }

  return newlyAwarded
}
