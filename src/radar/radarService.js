import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { getMutualFollowers } from '../firebase/profileService.js'
import { getUserCommunityMemberships } from '../firebase/communityService.js'

/**
 * Real scoring, not a hard filter — this is what sidesteps the exact
 * bug just being debugged in getNearbyStudents (a strict collegeId
 * equality filter returning zero on any data inconsistency). Fetches
 * a bounded candidate pool, scores every candidate on real signals,
 * sorts, returns the top N. A collegeId mismatch now degrades one
 * candidate's rank instead of making the whole feature fail.
 *
 * Scoring weights match the brief's own stated priority order (same
 * college > department > year > interests > mutual communities >
 * mutual friends) — each factor contributes decreasing weight down
 * that list.
 */

const SCORE_WEIGHTS = {
  sameCollege: 40,
  sameDepartment: 25,
  sameYear: 15,
  perSharedInterest: 4,
  perMutualCommunity: 3,
  perMutualFriend: 2
}

const CANDIDATE_POOL_SIZE = 80 // bounded fetch — never scans the whole users collection
const MAX_RESULTS = 20

async function computeMatch(currentProfile, currentUid, candidateDoc, currentCommunityIds, currentInterests) {
  const data = candidateDoc.data()
  const uid = candidateDoc.id

  let score = 0
  const reasons = []

  if (currentProfile.collegeId && data.collegeId === currentProfile.collegeId) {
    score += SCORE_WEIGHTS.sameCollege
    reasons.push('Same college')
  }
  if (currentProfile.course && data.course === currentProfile.course) {
    score += SCORE_WEIGHTS.sameDepartment
    reasons.push('Same department')
  }
  if (currentProfile.year && data.year === currentProfile.year) {
    score += SCORE_WEIGHTS.sameYear
    reasons.push('Same year')
  }

  const candidateInterests = Array.isArray(data.interests) ? data.interests : []
  const sharedInterests = candidateInterests.filter((i) => currentInterests.includes(i))
  if (sharedInterests.length > 0) {
    score += sharedInterests.length * SCORE_WEIGHTS.perSharedInterest
    reasons.push(`${sharedInterests.length} shared interest${sharedInterests.length > 1 ? 's' : ''}`)
  }

  // Mutual communities — cheap set intersection, no extra Firestore
  // read per candidate (currentCommunityIds is fetched once, up front,
  // by the caller; candidate's own memberships need one read per
  // candidate, which IS an N+1 pattern — accepted here because the
  // pool is bounded to CANDIDATE_POOL_SIZE, not unbounded).
  const candidateCommunities = await getUserCommunityMemberships(uid).catch(() => [])
  const candidateCommunityIds = candidateCommunities.map((m) => m.communityId)
  const mutualCommunityCount = candidateCommunityIds.filter((id) => currentCommunityIds.includes(id)).length
  if (mutualCommunityCount > 0) {
    score += mutualCommunityCount * SCORE_WEIGHTS.perMutualCommunity
    reasons.push(`${mutualCommunityCount} mutual communit${mutualCommunityCount > 1 ? 'ies' : 'y'}`)
  }

  const mutualFriends = await getMutualFollowers(currentUid, uid, { limit: 5 }).catch(() => [])
  if (mutualFriends.length > 0) {
    score += mutualFriends.length * SCORE_WEIGHTS.perMutualFriend
    reasons.push(`${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? 's' : ''}`)
  }

  return {
    uid,
    displayName: data.displayName ?? data.fullName ?? '',
    username: data.username ?? '',
    avatar: data.avatar ?? data.photoURL ?? '',
    course: data.course ?? '',
    year: data.year ?? '',
    collegeId: data.collegeId ?? null,
    interests: candidateInterests,
    verifiedCampus: data.verifiedCampus ?? false,
    mutualCommunityCount,
    mutualFriendCount: mutualFriends.length,
    sharedInterestCount: sharedInterests.length,
    score,
    reasons
  }
}

/**
 * One-time fetch + score. Real-time updates (subscribeToRadarMatches
 * below) re-run this same scoring logic whenever the candidate pool's
 * underlying query snapshot changes — no separate live-scoring code
 * path to keep in sync with this one.
 */
export async function getRadarMatches(currentUid, currentProfile) {
  if (!currentUid) return []

  const currentInterests = Array.isArray(currentProfile?.interests) ? currentProfile.interests : []
  const currentCommunities = await getUserCommunityMemberships(currentUid).catch(() => [])
  const currentCommunityIds = currentCommunities.map((m) => m.communityId)

  const poolSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(CANDIDATE_POOL_SIZE)))
  const candidates = poolSnap.docs.filter((d) => d.id !== currentUid)

  const scored = await Promise.all(
    candidates.map((d) => computeMatch(currentProfile || {}, currentUid, d, currentCommunityIds, currentInterests))
  )

  return scored.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS)
}

/**
 * Live version — re-scores whenever the underlying candidate pool
 * changes (a new signup, a profile update within the pool window).
 * Scoring itself isn't a live listener (mutual-community/mutual-
 * friend lookups are one-time reads per candidate) — this re-runs the
 * full score on every pool change, which is fine at
 * CANDIDATE_POOL_SIZE=80, not designed to scale to a live listener on
 * a much larger pool without further work.
 */
export function subscribeToRadarMatches(currentUid, currentProfile, callback) {
  if (!currentUid) {
    callback([])
    return () => {}
  }

  const poolQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(CANDIDATE_POOL_SIZE))

  return onSnapshot(poolQuery, async (snap) => {
    const currentInterests = Array.isArray(currentProfile?.interests) ? currentProfile.interests : []
    const currentCommunities = await getUserCommunityMemberships(currentUid).catch(() => [])
    const currentCommunityIds = currentCommunities.map((m) => m.communityId)

    const candidates = snap.docs.filter((d) => d.id !== currentUid)
    const scored = await Promise.all(
      candidates.map((d) => computeMatch(currentProfile || {}, currentUid, d, currentCommunityIds, currentInterests))
    )

    callback(scored.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS))
  })
}

export function matchTier(score) {
  if (score >= 50) return 'high'
  if (score >= 20) return 'medium'
  return 'low'
}
