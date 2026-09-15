import { getUserProfile, getMutualFollowers, getFollowingSet } from '../firebase/profileService.js'
import { getUserCommunityMemberships } from '../firebase/communityService.js'
import { getBlockedUsers } from '../firebase/blockService.js'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { findNearbyUserLocations } from './radarLocationService.js'

/**
 * ROOT CAUSE (this pass, confirmed by reading the prior version
 * directly, plus the file's own comment history): an earlier pass had
 * ALREADY tried "physical GPS proximity as the primary result set,"
 * gating the whole pool behind findNearbyUserLocations' real GPS +
 * geohash query within RADAR_RADIUS_METERS (15m). That is precisely
 * why Radar was unreliable — 15 meters is far tighter than typical
 * browser Geolocation accuracy (commonly 20-100m+, especially
 * indoors/on laptops with no GPS chip), so two real people standing
 * near each other routinely fail to match, and Radar shows nothing to
 * show for it, with no fallback at all when location is denied,
 * unavailable, or simply imprecise.
 *
 * This pass rebalances it per the explicit product direction: campus
 * identity (collegeId, already on every profile) is now the PRIMARY,
 * always-available discovery pool — Radar works the instant you open
 * it, logged in, on any device, with location permission untouched.
 * Physical GPS proximity (still fully real — same haversine/geohash
 * machinery, untouched) is layered ON TOP as an enhancement: when a
 * fresh nearby-location match exists for someone already in the pool,
 * they get a real distance badge and a ranking boost; it never GATES
 * who appears. RADAR_RADIUS_METERS was also widened from 15m to a
 * realistic same-building/area distance (see radarLocationService.js).
 */
const CAMPUS_POOL_SIZE = 24

/**
 * The reliable, always-available discovery pool — no location
 * permission required. Bounded fetch (CAMPUS_POOL_SIZE), single
 * equality query on the existing collegeId field (already indexed by
 * Firestore automatically — no composite index needed for one
 * equality filter), never the whole users collection.
 */
async function getCampusPool(currentUid, collegeId) {
  if (!collegeId) return []
  const snap = await getDocs(
    query(collection(db, 'users'), where('collegeId', '==', collegeId), limit(CAMPUS_POOL_SIZE + 1))
  )
  return snap.docs.map((d) => d.id).filter((uid) => uid !== currentUid).slice(0, CAMPUS_POOL_SIZE)
}

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
 * One-time fetch: finds physically nearby users (real GPS query, the
 * ONLY visibility decision), then best-effort enriches each with
 * compatibility scoring for display only. Root-cause fix: the prior
 * version let a failed/null compatibility lookup silently drop an
 * already-distance-verified nearby user via .filter(Boolean) — a
 * person could be 2m away, correctly found by findNearbyUserLocations,
 * and still vanish from the result if computeCompatibility's extra
 * getUserProfile call hiccuped for any reason. Distance decides who
 * appears; compatibility only decides how they're annotated once
 * they're already in the list.
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
      ).catch(() => null)

      // A failed/missing compatibility lookup no longer removes this
      // person from Radar — they were already confirmed within range
      // by real GPS distance. They still show, with a minimal
      // fallback identity (their uid is always known — it came from
      // the location document itself) and zero score, rather than
      // disappearing entirely.
      const base = compatibility || {
        uid: loc.uid,
        displayName: '',
        username: '',
        avatar: '',
        campusAvatarUrl: '',
        avatarMode: 'photo',
        course: '',
        year: '',
        interests: [],
        verifiedCampus: false,
        mutualCommunityCount: 0,
        mutualFriendCount: 0,
        sharedInterestCount: 0,
        score: 0,
        reasons: []
      }

      return { ...base, distanceMeters: loc.distanceMeters, locationAccuracy: loc.accuracy }
    })
  )

  return enriched.sort((a, b) => a.distanceMeters - b.distanceMeters)
}

/**
 * The real entry point RadarPage now uses. Campus identity (getCampusPool)
 * is the reliable, always-on discovery pool; `position` (optional — a
 * device that never granted location, or hasn't yet, works exactly the
 * same otherwise) additionally pulls in anyone genuinely GPS-nearby and
 * attaches a real distance to whoever it confirms, without ever gating
 * the whole list on it. Blocked users and people already excluded via
 * getBlockedUsers never enter the candidate set at all — filtered
 * before any profile is even fetched, not hidden after the fact.
 */
export async function getRadarResults(currentUid, currentProfile, position) {
  if (!currentUid) return []

  const collegeId = currentProfile?.collegeId

  const [campusUids, blockedList, followingSet, nearbyLocations] = await Promise.all([
    getCampusPool(currentUid, collegeId),
    getBlockedUsers(currentUid).catch(() => []),
    getFollowingSet(currentUid).catch(() => new Set()),
    position ? findNearbyUserLocations(currentUid, position.lat, position.lng).catch(() => []) : Promise.resolve([])
  ])

  const blockedUids = new Set(blockedList.map((b) => b.blockedUid))
  const nearbyByUid = new Map(nearbyLocations.map((loc) => [loc.uid, loc]))

  // Campus pool plus anyone genuinely nearby who wasn't already in it
  // (e.g. a visitor from a different college standing right next to
  // you) — capped, so a GPS addition can never balloon the list past
  // a bounded size.
  const candidateUids = new Set(campusUids)
  nearbyLocations.forEach((loc) => {
    if (candidateUids.size < CAMPUS_POOL_SIZE + 10) candidateUids.add(loc.uid)
  })
  blockedUids.forEach((uid) => candidateUids.delete(uid))
  candidateUids.delete(currentUid)

  if (candidateUids.size === 0) return []

  const currentInterests = Array.isArray(currentProfile?.interests) ? currentProfile.interests : []
  const currentCommunities = await getUserCommunityMemberships(currentUid).catch(() => [])
  const currentCommunityIds = currentCommunities.map((m) => m.communityId)

  const enriched = await Promise.all(
    Array.from(candidateUids).map(async (uid) => {
      const compatibility = await computeCompatibility(currentProfile || {}, currentUid, uid, currentCommunityIds, currentInterests).catch(
        () => null
      )
      // Unlike the pure-GPS path above, a campus-pool candidate whose
      // profile lookup fails has nothing else confirming they're real
      // (no distance signal did that here) — dropped, not shown blank.
      if (!compatibility) return null
      const nearby = nearbyByUid.get(uid)
      return {
        ...compatibility,
        isFollowing: followingSet.has(uid),
        distanceMeters: nearby ? nearby.distanceMeters : null,
        locationAccuracy: nearby ? nearby.accuracy : null
      }
    })
  )

  return enriched.filter(Boolean).sort((a, b) => {
    // Confirmed-nearby people surface first (closest first); everyone
    // else ranks by campus-compatibility score.
    if (a.distanceMeters != null && b.distanceMeters == null) return -1
    if (a.distanceMeters == null && b.distanceMeters != null) return 1
    if (a.distanceMeters != null && b.distanceMeters != null) return a.distanceMeters - b.distanceMeters
    return b.score - a.score
  })
}

export function matchTier(score) {
  if (score >= 50) return 'high'
  if (score >= 20) return 'medium'
  return 'low'
}
