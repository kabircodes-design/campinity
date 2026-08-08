import { getUserProfile, getMutualFollowers } from '../firebase/profileService.js'
import { getUserCommunityMemberships } from '../firebase/communityService.js'
import { findNearbyUserLocations } from './radarLocationService.js'

/**
 * Root cause of the prior bug, confirmed by reading the previous
 * version of this file directly: it answered "who is registered on
 * my campus" (a broad social-matching pool with no physical location
 * involved at all), not "who is physically near me." This rewrite
 * makes physical proximity (findNearbyUserLocations,
 * radarLocationService.js — real GPS + geohash query) the PRIMARY
 * result set. A user only appears here at all if they are within
 * RADAR_RADIUS_METERS right now, per radarLocationService.js's own
 * freshness and distance filtering.
 *
 * Social scoring (college/department/year/interests/mutual
 * communities/mutual friends) is layered ON TOP of the nearby set,
 * not used to build the pool — it now answers "how compatible is
 * this physically-nearby person," which drives the compatibility
 * ring color and the "why you matched" list, while distanceMeters
 * (real, from GPS) drives positioning on the radar visualization.
 * This is the "keep existing visual design/functionality, fix the
 * underlying data logic" instruction applied directly: the ring-color
 * and match-reasons UI is unchanged, what feeds it changed.
 */

const SCORE_WEIGHTS = {
  sameCollege: 40,
  sameDepartment: 25,
  sameYear: 15,
  perSharedInterest: 4,
  perMutualCommunity: 3,
  perMutualFriend: 2
}

async function computeCompatibility(currentProfile, currentUid, candidateUid, currentCommunityIds, currentInterests) {
  const data = await getUserProfile(candidateUid)
  if (!data) return null

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

  const candidateCommunities = await getUserCommunityMemberships(candidateUid).catch(() => [])
  const candidateCommunityIds = candidateCommunities.map((m) => m.communityId)
  const mutualCommunityCount = candidateCommunityIds.filter((id) => currentCommunityIds.includes(id)).length
  if (mutualCommunityCount > 0) {
    score += mutualCommunityCount * SCORE_WEIGHTS.perMutualCommunity
    reasons.push(`${mutualCommunityCount} mutual communit${mutualCommunityCount > 1 ? 'ies' : 'y'}`)
  }

  const mutualFriends = await getMutualFollowers(currentUid, candidateUid, { limit: 5 }).catch(() => [])
  if (mutualFriends.length > 0) {
    score += mutualFriends.length * SCORE_WEIGHTS.perMutualFriend
    reasons.push(`${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? 's' : ''}`)
  }

  return {
    uid: candidateUid,
    displayName: data.displayName ?? '',
    username: data.username ?? '',
    avatar: data.avatar ?? '',
    campusAvatarUrl: data.campusAvatarUrl ?? '',
    avatarMode: data.avatarMode ?? 'photo',
    course: data.course ?? '',
    year: data.year ?? '',
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
 * One-time fetch: finds physically nearby users (real GPS query),
 * then enriches each with compatibility scoring for display. Not a
 * live subscription itself — the caller (useRadarPresence.js) re-runs
 * this periodically as the user's own location updates, since a
 * geohash-prefix query has no live onSnapshot equivalent that also
 * handles the moving-query-center case cleanly.
 */
export async function getNearbyMatches(currentUid, currentProfile, lat, lng) {
  if (!currentUid || lat == null || lng == null) return []

  const nearbyLocations = await findNearbyUserLocations(currentUid, lat, lng)
  if (nearbyLocations.length === 0) return []

  const currentInterests = Array.isArray(currentProfile?.interests) ? currentProfile.interests : []
  const currentCommunities = await getUserCommunityMemberships(currentUid).catch(() => [])
  const currentCommunityIds = currentCommunities.map((m) => m.communityId)

  const enriched = await Promise.all(
    nearbyLocations.map(async (loc) => {
      const compatibility = await computeCompatibility(
        currentProfile || {},
        currentUid,
        loc.uid,
        currentCommunityIds,
        currentInterests
      )
      if (!compatibility) return null
      return { ...compatibility, distanceMeters: loc.distanceMeters, locationAccuracy: loc.accuracy }
    })
  )

  return enriched.filter(Boolean).sort((a, b) => a.distanceMeters - b.distanceMeters)
}

export function matchTier(score) {
  if (score >= 50) return 'high'
  if (score >= 20) return 'medium'
  return 'low'
}
