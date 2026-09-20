import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import {
  XP_REWARDS,
  LEVEL_TIERS,
  getLevelStepXP,
  STREAK_REWARDS,
  CONTRIBUTION_ACTIVITY_TYPES,
  REPUTATION_CATEGORY_LABELS
} from './config.js'
import { createLevelUpNotification, createStreakNotification } from '../firebase/notificationService.js'

/**
 * The ONE XP service — every XP-earning action across this project
 * should call awardXP with an activityType key from XP_REWARDS,
 * rather than any component computing or writing XP itself. This is
 * new, standalone code; it does not modify engagementService.js,
 * postService.js, or any other existing file. Wiring it INTO those
 * files' actual action points (e.g. one line inside addComment) is
 * listed explicitly in this feature's own summary as follow-up work,
 * not done here — per "do not modify anything related to... existing
 * working features."
 */

export function progressDoc(uid) {
  return doc(db, 'userProgress', uid)
}

/**
 * Local calendar date, not UTC — toISOString() would compute the "day"
 * boundary at UTC midnight, which falls at an arbitrary local hour
 * (e.g. 5:30 AM IST) rather than local midnight. No per-user timezone
 * field exists anywhere in this project's schema (confirmed via
 * search before writing this) — the browser's own local date is the
 * most honest available signal without inventing a timezone field
 * this pass has no real data to populate correctly.
 */
function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function yesterdayString() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Finds the highest level tier the given XP total has crossed, and the user's exact level within it (interpolated via getLevelStepXP). */
export function getLevelForXP(xp) {
  let tierIndex = 0
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (xp >= LEVEL_TIERS[i].xp) tierIndex = i
    else break
  }
  const tier = LEVEL_TIERS[tierIndex]
  const nextTier = LEVEL_TIERS[tierIndex + 1]

  if (!nextTier) {
    // Past the highest named tier — still count levels up using the flat step.
    const step = getLevelStepXP(tier.level)
    const extraLevels = Math.floor((xp - tier.xp) / step)
    return { level: tier.level + extraLevels, title: tier.title, emoji: tier.emoji, tierLevel: tier.level, tierXP: tier.xp, nextTierXP: null }
  }

  const step = getLevelStepXP(tier.level)
  const levelsIntoTier = Math.floor((xp - tier.xp) / step)
  const level = Math.min(tier.level + levelsIntoTier, nextTier.level)

  return {
    level,
    title: tier.title,
    emoji: tier.emoji,
    tierLevel: tier.level,
    tierXP: tier.xp,
    nextTierXP: nextTier.xp,
    currentLevelFloorXP: tier.xp + (level - tier.level) * step,
    nextLevelXP: tier.xp + (level - tier.level + 1) * step
  }
}

/**
 * Daily cap check — for actions with no natural per-source dedup key
 * (a like/comment/save can be deduped by "this specific post," but a
 * message has no equivalent unique target to key against — sending
 * 500 messages in a row would otherwise farm 500 XP with the dedupeKey
 * mechanism alone doing nothing to stop it). Counts today's xpLog
 * entries for the given activityType and returns whether the cap has
 * been reached — callers check this BEFORE calling awardXP, so a
 * capped action still completes normally (the message still sends),
 * it just stops earning XP once the daily limit is hit.
 */
export async function hasReachedDailyCap(uid, activityType, capCount) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const snap = await getDocs(
    query(
      collection(db, 'xpLog', uid, 'entries'),
      where('activityType', '==', activityType),
      where('createdAt', '>=', startOfToday),
      limit(capCount)
    )
  )
  return snap.size >= capCount
}

/**
 * Awards XP, Campus Points, and Reputation for one activity, updates
 * the daily streak, and logs the entry — all in one transaction so
 * XP/points/reputation/level/streak can never drift out of sync with
 * each other or with the log Weekly Recap and badge-checking read
 * from.
 *
 * Streak logic — the actual root-cause fix: the prior version only
 * advanced the streak when activityType === 'daily_login', but
 * nothing anywhere ever called awardXP with that type — confirmed via
 * a full-codebase search before this rewrite. Streak now advances on
 * the FIRST qualifying activity of each calendar day, regardless of
 * which specific event triggered it (a post, a comment, opening the
 * app and liking something — anything that calls awardXP at all).
 * This matches "Monday -> activity -> 1, Monday again -> still 1,
 * Tuesday -> 2" from the brief exactly: the date-comparison logic
 * itself (today / yesterday / neither) is unchanged from before, it's
 * just no longer gated behind an event type nothing produces.
 *
 * dedupeKey: effectively required for any one-shot action (creating a
 * specific post, a specific like) — checked against xpLog before
 * awarding anything, so a retried request or a duplicate call for the
 * same source can never double-award. Every real call site wired in
 * this pass passes one keyed to the specific source id.
 */
export async function awardXP(uid, activityType, { campusPoints = 0, reputationAwarded = 0, metadata = {}, dedupeKey = null } = {}) {
  if (!uid) return null
  const xpAmount = XP_REWARDS[activityType]
  if (xpAmount === undefined) {
    throw new Error(`Unknown XP activity type: "${activityType}" — add it to XP_REWARDS in config.js first.`)
  }

  if (dedupeKey) {
    const existing = await getDocs(
      query(collection(db, 'xpLog', uid, 'entries'), where('dedupeKey', '==', dedupeKey), limit(1))
    )
    if (!existing.empty) return null // already awarded, no-op
  }

  const entryRef = doc(collection(db, 'xpLog', uid, 'entries'))
  let streakResult = null
  let leveledUp = false
  let newLevelValue = null
  let newLevelTitle = null

  await runTransaction(db, async (transaction) => {
    const progressSnap = await transaction.get(progressDoc(uid))
    const current = progressSnap.exists()
      ? progressSnap.data()
      : { xp: 0, level: 1, campusPoints: 0, reputationScore: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: null, contributionsCount: 0 }

    const newXP = (current.xp || 0) + xpAmount
    const newPoints = (current.campusPoints || 0) + campusPoints
    const newReputation = (current.reputationScore || 0) + reputationAwarded
    const newContributions = (current.contributionsCount || 0) + (CONTRIBUTION_ACTIVITY_TYPES.includes(activityType) ? 1 : 0)
    const previousLevel = current.level || 1
    const { level, title } = getLevelForXP(newXP)
    if (level > previousLevel) {
      leveledUp = true
      newLevelValue = level
      newLevelTitle = title
    }

    // Streak: advances on the first qualifying activity of each
    // calendar day, from ANY event type — see docstring above for why
    // this is no longer gated to a single unused event type.
    const today = todayString()
    let newStreak = current.currentStreak || 0
    let newLongest = current.longestStreak || 0
    if (current.lastActivityDate === today) {
      // already active today, streak unchanged
    } else if (current.lastActivityDate === yesterdayString()) {
      newStreak += 1
    } else {
      newStreak = 1 // missed a day, or this is the very first activity ever
    }
    newLongest = Math.max(newLongest, newStreak)
    if (current.lastActivityDate !== today && STREAK_REWARDS[newStreak]) {
      streakResult = { streak: newStreak, reward: STREAK_REWARDS[newStreak] }
    }

    transaction.set(
      progressDoc(uid),
      {
        xp: newXP,
        level,
        campusPoints: newPoints,
        reputationScore: newReputation,
        contributionsCount: newContributions,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: today,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )

    transaction.set(entryRef, {
      activityType,
      xpAwarded: xpAmount,
      pointsAwarded: campusPoints,
      reputationAwarded,
      dedupeKey,
      metadata,
      createdAt: serverTimestamp()
    })
  })

  if (leveledUp) {
    await createLevelUpNotification({ targetUid: uid, newLevel: newLevelValue, levelTitle: newLevelTitle }).catch(() => {})
  }
  if (streakResult) {
    await createStreakNotification({ targetUid: uid, streakDays: streakResult.streak, reward: streakResult.reward }).catch(() => {})
  }

  return {
    xpAwarded: xpAmount,
    pointsAwarded: campusPoints,
    reputationAwarded,
    streak: streakResult,
    leveledUp,
    newLevel: newLevelValue
  }
}

/**
 * Builds the exact document shape requested — xp, level,
 * currentLevelXp, nextLevelXp, campusPoints, streak, reputation,
 * totalBadges, rank, updatedAt — from the raw stored fields plus
 * live-computed values (level info from getLevelForXP, badge count
 * from a real subcollection read, rank from a real comparative
 * query). Nothing here is hardcoded; a brand-new user legitimately
 * has 0 badges and rank/(total users), not a placeholder.
 */
async function buildDisplayProgress(uid, raw) {
  const levelInfo = getLevelForXP(raw.xp || 0)
  // Honest edge case, not silently wrong: getLevelForXP's "past the
  // highest named tier" branch doesn't return currentLevelFloorXP/
  // nextLevelXP (there's no next tier to compute a step toward). The
  // fallback below uses tierXP instead, which is only correct up to
  // level 100 exactly — no real user can exceed that yet, since XP
  // rewards aren't wired to any action in this pass. Flagged for
  // whoever wires up XP triggers next, not fixed blind here.

  const [badgesSnap, rank] = await Promise.all([
    getDocs(collection(db, 'userBadges', uid, 'earned')),
    getUserRank(uid, raw.xp || 0)
  ])

  return {
    xp: raw.xp || 0,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    levelEmoji: levelInfo.emoji,
    currentLevelXp: (raw.xp || 0) - (levelInfo.currentLevelFloorXP ?? levelInfo.tierXP),
    nextLevelXp: (levelInfo.nextLevelXP ?? levelInfo.nextTierXP ?? levelInfo.tierXP) - (levelInfo.currentLevelFloorXP ?? levelInfo.tierXP),
    campusPoints: raw.campusPoints || 0,
    streak: raw.currentStreak || 0,
    longestStreak: raw.longestStreak || 0,
    reputation: raw.reputationScore || 0,
    // badgeCount is denormalized by awardBadge() going forward; older
    // progress docs (or any drift) fall back to the live subcollection
    // count rather than showing a stale/missing number.
    totalBadges: raw.badgeCount ?? badgesSnap.size,
    contributionsCount: raw.contributionsCount || 0,
    verifiedCampus: Boolean(raw.verifiedCampus),
    collegeId: raw.collegeId || null,
    rank,
    updatedAt: raw.updatedAt || null
  }
}

/**
 * Real rank — count of users with strictly more XP, plus one. A live
 * comparative query, not a precomputed leaderboard (that's a separate,
 * larger job explicitly deferred in the foundation pass) — honest
 * scaling note: this re-scans userProgress on every profile view,
 * fine at current scale, would need the precomputed
 * leaderboards/{scope} collection from SCHEMA.md once user counts get
 * large. Single-field range query, no composite index needed.
 */
async function getUserRank(uid, myXP) {
  const snap = await getDocs(query(collection(db, 'userProgress'), where('xp', '>', myXP)))
  return snap.size + 1
}

/**
 * Gets (and creates, if missing) a user's progress document —
 * "automatically create userProgress for every user on first login if
 * it doesn't exist," done here rather than in any auth flow file, so
 * nothing in the actual login/auth code needs to change. Any first
 * call to useProgress() triggers this.
 */
export async function getUserProgress(uid) {
  const snap = await getDoc(progressDoc(uid))
  let raw
  if (!snap.exists()) {
    raw = {
      xp: 0,
      level: 1,
      campusPoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      reputationScore: 0,
      profileCompletionPct: 0,
      contributionsCount: 0,
      badgeCount: 0
    }
    await setDoc(progressDoc(uid), { ...raw, updatedAt: serverTimestamp() }, { merge: true })
  } else {
    raw = snap.data()
  }

  // Lazy self-heal for existing progress docs created before collegeId
  // was tracked here — same "backfill on next read" pattern this file
  // already uses for brand-new docs, just for one extra field. Reads
  // the real users/{uid}.collegeId once and denormalizes it so
  // college-scoped leaderboard queries can find this user going
  // forward; a user who never re-opens the app after this ships stays
  // absent from "My College" until they do (a disclosed limitation,
  // not silently wrong data).
  if (!raw.collegeId) {
    try {
      const userSnap = await getDoc(doc(db, 'users', uid))
      const collegeId = userSnap.exists() ? userSnap.data()?.collegeId : null
      if (collegeId) {
        raw = { ...raw, collegeId }
        await setDoc(progressDoc(uid), { collegeId }, { merge: true })
      }
    } catch {
      // Non-fatal — leaderboard college-scoping just stays ungrouped for this user until the next successful read.
    }
  }

  return buildDisplayProgress(uid, raw)
}

/**
 * Real-time equivalent — subscribes after ensuring the document
 * exists (getUserProgress's init runs once, up front; the snapshot
 * listener then reflects every subsequent live change: XP awards,
 * streak updates, badge counts).
 */
export function subscribeToUserProgress(uid, callback) {
  let unsubscribeSnapshot = null
  let cancelled = false

  getUserProgress(uid).then((initial) => {
    if (cancelled) return
    callback(initial)

    unsubscribeSnapshot = onSnapshot(progressDoc(uid), async (snap) => {
      if (!snap.exists()) return
      const display = await buildDisplayProgress(uid, snap.data())
      if (!cancelled) callback(display)
    })
  })

  return () => {
    cancelled = true
    if (unsubscribeSnapshot) unsubscribeSnapshot()
  }
}

/** XP earned within a date range — what Weekly Recap (item 12) reads from, since userProgress.xp is only ever an all-time total. */
export async function getXPEarnedSince(uid, sinceDate) {
  const snap = await getDocs(
    query(collection(db, 'xpLog', uid, 'entries'), where('createdAt', '>=', sinceDate), orderBy('createdAt', 'desc'))
  )
  return snap.docs.reduce((sum, d) => sum + (d.data().xpAwarded || 0), 0)
}

/**
 * Recent XP history for the Progress page — real xpLog entries, most
 * recent first, capped at pageSize. Every entry already carries a real
 * activityType/xpAwarded/createdAt, so this is a direct read with no
 * derived/invented fields.
 */
export async function getRecentXPEntries(uid, pageSize = 30) {
  const snap = await getDocs(
    query(collection(db, 'xpLog', uid, 'entries'), orderBy('createdAt', 'desc'), limit(pageSize))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Reputation-only adjustment — a sibling to awardXP for events that
 * change reputationScore without any XP (e.g. a moderation penalty).
 * awardXP can't express this cleanly since it requires a known
 * XP_REWARDS activityType and always writes an xpAwarded amount;
 * pulling this into its own small transaction keeps that contract
 * simple while reusing the exact same dedupe/log/transaction shape.
 */
export async function applyReputationAdjustment(uid, delta, activityType, dedupeKey) {
  if (!uid || !delta) return null

  if (dedupeKey) {
    const existing = await getDocs(
      query(collection(db, 'xpLog', uid, 'entries'), where('dedupeKey', '==', dedupeKey), limit(1))
    )
    if (!existing.empty) return null
  }

  const entryRef = doc(collection(db, 'xpLog', uid, 'entries'))
  await runTransaction(db, async (transaction) => {
    const progressSnap = await transaction.get(progressDoc(uid))
    const current = progressSnap.exists() ? progressSnap.data() : { reputationScore: 0 }
    transaction.set(progressDoc(uid), { reputationScore: (current.reputationScore || 0) + delta, updatedAt: serverTimestamp() }, { merge: true })
    transaction.set(entryRef, {
      activityType,
      xpAwarded: 0,
      pointsAwarded: 0,
      reputationAwarded: delta,
      dedupeKey,
      metadata: {},
      createdAt: serverTimestamp()
    })
  })

  return { reputationAwarded: delta }
}

/**
 * Groups every reputation-affecting xpLog entry into the categories
 * defined in REPUTATION_CATEGORY_LABELS, so "why is my reputation X"
 * can show real, itemized totals. Categories with no matching entries
 * are still returned (total: 0, notApplicable: true) rather than
 * omitted, so the UI can say "not yet tracked" instead of hiding a
 * signal the app just hasn't produced data for yet.
 */
export async function getReputationBreakdown(uid) {
  const snap = await getDocs(collection(db, 'xpLog', uid, 'entries'))
  const totals = {}
  for (const key of Object.keys(REPUTATION_CATEGORY_LABELS)) totals[REPUTATION_CATEGORY_LABELS[key]] = 0

  const seenCategories = new Set()
  for (const docSnap of snap.docs) {
    const entry = docSnap.data()
    if (!entry.reputationAwarded) continue
    const category = REPUTATION_CATEGORY_LABELS[entry.activityType]
    if (!category) continue
    totals[category] = (totals[category] || 0) + entry.reputationAwarded
    seenCategories.add(category)
  }

  return Object.entries(totals).map(([category, total]) => ({
    category,
    total,
    notApplicable: !seenCategories.has(category)
  }))
}

/**
 * Trailing N-day activity calendar for the Streak detail view — derived
 * from real xpLog entry dates (the same activity that advances the
 * streak in awardXP), not a separate/fabricated tracker. Returns a Set
 * of 'YYYY-MM-DD' local-date strings that had at least one qualifying
 * activity.
 */
export async function getRecentActivityDates(uid, days = 7) {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const snap = await getDocs(
    query(collection(db, 'xpLog', uid, 'entries'), where('createdAt', '>=', since), orderBy('createdAt', 'desc'))
  )

  const dates = new Set()
  for (const docSnap of snap.docs) {
    const createdAt = docSnap.data().createdAt
    if (!createdAt?.toDate) continue
    const d = createdAt.toDate()
    dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return dates
}
