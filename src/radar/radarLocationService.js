import { collection, deleteDoc, doc, getDocs, limit, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase/firebase.js'
import { encodeGeohash, geohashPrefixForQuery, geohashNeighborhood, haversineMeters, RADAR_GEOHASH_PRECISION } from './geohash.js'

/**
 * New collection: radarLocations/{uid}. NOT stored on users/{uid} —
 * deliberately. users/{uid} has an unconditional read rule (any
 * signed-in user can read the full document), which would mean exact
 * lat/lng sitting there is readable by every signed-in user via the
 * SDK directly regardless of what the UI displays — the opposite of
 * "do not expose exact lat/lng." A separate collection lets read
 * access, freshness, and the privacy toggle all be governed
 * independently of the profile document, and lets a disabled user be
 * removed from the queryable pool entirely (see disableRadarVisibility
 * below) rather than just hidden by a flag a client could ignore.
 *
 * Fields: geohash (string, precision 7, indexed for the range query —
 * see RADAR_GEOHASH_PRECISION), lat, lng (numbers), accuracy (meters,
 * from the browser's own GeolocationPosition.coords.accuracy),
 * updatedAt (server timestamp, the freshness signal).
 *
 * Read: any signed-in user (required — the querying client needs to
 * read candidate documents to compute real distance client-side;
 * there's no server-side geospatial function in this Firestore-only
 * architecture). Write: owner only, enforced by firestore.rules.
 */

const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes — a location older than this isn't shown as "nearby right now"
const RADAR_RADIUS_METERS = 15
const MIN_UPDATE_DISTANCE_METERS = 5 // don't write to Firestore unless the user has actually moved at least this far
const MIN_UPDATE_INTERVAL_MS = 15000 // ...or at least this much time has passed, whichever comes first — throttling to avoid draining battery/writes

function locationDoc(uid) {
  return doc(db, 'radarLocations', uid)
}

/**
 * Called from the geolocation watcher (see useRadarLocation.js) on
 * every position update — throttling happens in THIS function, not
 * the caller, so every call site gets the same battery/write
 * protection automatically. lastWrite is passed in and returned
 * (rather than kept as module state) so multiple RadarPage mounts
 * don't share throttle state incorrectly.
 */
export async function maybeUpdateMyLocation(uid, coords, lastWrite) {
  const { latitude, longitude, accuracy } = coords
  const now = Date.now()

  if (lastWrite) {
    const elapsed = now - lastWrite.timestamp
    const moved = haversineMeters(latitude, longitude, lastWrite.lat, lastWrite.lng)
    if (elapsed < MIN_UPDATE_INTERVAL_MS && moved < MIN_UPDATE_DISTANCE_METERS) {
      return lastWrite // throttled — no write, no state change
    }
  }

  await setDoc(locationDoc(uid), {
    geohash: encodeGeohash(latitude, longitude, RADAR_GEOHASH_PRECISION + 2), // stored at higher precision than the query prefix, for accurate haversine filtering after the range query
    lat: latitude,
    lng: longitude,
    accuracy: accuracy ?? null,
    updatedAt: serverTimestamp()
  })

  // TEMPORARY — remove once cross-device visibility is confirmed.
  // Confirms the write actually completed (setDoc resolved without
  // throwing) rather than assuming success from the absence of a UI
  // error — a rejected promise the caller silently swallowed would
  // otherwise look identical to a successful write from the outside.
  console.log('[Radar] location write confirmed:', { uid, lat: latitude, lng: longitude, accuracy })

  return { lat: latitude, lng: longitude, timestamp: now }
}

/** Radar visibility off — per "a user who disables Radar should not appear to others," this removes them from the queryable pool entirely rather than setting a flag a client-side query could ignore. */
export async function disableRadarVisibility(uid) {
  await deleteDoc(locationDoc(uid))
}

/**
 * Finds users within RADAR_RADIUS_METERS of (lat, lng). Queries the
 * current cell PLUS its 8 neighbors (production-hardening pass — the
 * single-cell version's boundary limitation is closed), then a REAL
 * haversine filter on every deduped candidate to eliminate the
 * geohash bounding box's false positives (a prefix match only proves
 * "roughly nearby," not "within exactly 10m" — the square-shaped
 * geohash cell doesn't match a circular radius, so this filter is
 * required, not optional), then
 * a freshness filter (STALE_THRESHOLD_MS) so a location from 20
 * minutes ago doesn't count as "here right now."
 *
 * Excludes the current user (never appears as their own Radar
 * signal). Bounded fetch — the geohash-prefix query itself only
 * returns documents in this cell, not the whole radarLocations
 * collection, satisfying "do not download all campus users."
 */
/**
 * Production-hardening pass: queries the current cell PLUS all 8
 * neighbors (geohashNeighborhood, verified in geohash.js) instead of
 * a single cell — this is what closes the boundary limitation flagged
 * in the prior pass. Nine parallel range queries, results merged and
 * deduped by uid before the haversine filter runs, so a person 5-10m
 * away can no longer disappear merely for being in an adjacent cell.
 * Geohash proximity is NEVER the final distance decision at any point
 * in this function — it only decides which documents get fetched;
 * every returned result's distance comes from an actual haversineMeters
 * calculation against the real stored lat/lng.
 */
export async function findNearbyUserLocations(currentUid, lat, lng, { pageSize = 40 } = {}) {
  const centerCell = geohashPrefixForQuery(lat, lng)
  const cellsToQuery = geohashNeighborhood(centerCell)

  // TEMPORARY — remove once cross-device visibility is confirmed.
  console.log('[Radar] query start:', { currentUid, currentGeohash: centerCell, currentLat: lat, currentLng: lng, cellsQueried: cellsToQuery })

  const snapshots = await Promise.all(
    cellsToQuery.map((cellPrefix) =>
      getDocs(
        query(
          collection(db, 'radarLocations'),
          where('geohash', '>=', cellPrefix),
          where('geohash', '<=', cellPrefix + '\uf8ff'),
          limit(pageSize)
        )
      )
    )
  )

  // TEMPORARY — remove once confirmed. Per-cell result counts.
  snapshots.forEach((snap, i) => console.log(`[Radar] cell ${cellsToQuery[i]}: ${snap.docs.length} documents`))

  const seenUids = new Set()
  const candidates = []
  snapshots.forEach((snap) => {
    snap.docs.forEach((d) => {
      if (seenUids.has(d.id)) return // dedupe — a user's stored geohash could theoretically be returned by more than one prefix range in edge cases
      seenUids.add(d.id)
      candidates.push(d)
    })
  })

  const now = Date.now()
  const nearby = []

  candidates.forEach((d) => {
    const data = d.data()

    if (d.id === currentUid) {
      console.log(`[Radar] excluded: current user (${d.id})`) // TEMPORARY
      return
    }

    const updatedAtMs = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : 0
    const ageMs = now - updatedAtMs
    if (ageMs > STALE_THRESHOLD_MS) {
      console.log(`[Radar] excluded: stale (${d.id}), age=${Math.round(ageMs / 1000)}s, threshold=${STALE_THRESHOLD_MS / 1000}s`) // TEMPORARY
      return
    }

    if (data.lat == null || data.lng == null) {
      console.log(`[Radar] excluded: missing coordinates (${d.id})`) // TEMPORARY
      return
    }

    // The real, final distance decision — never the geohash cell membership itself.
    const distanceMeters = haversineMeters(lat, lng, data.lat, data.lng)
    if (distanceMeters > RADAR_RADIUS_METERS) {
      console.log(`[Radar] excluded: outside 10m (${d.id}), distance=${distanceMeters.toFixed(1)}m, candidateAccuracy=${data.accuracy}`) // TEMPORARY
      return
    }

    console.log(`[Radar] included: ${d.id}, distance=${distanceMeters.toFixed(1)}m, age=${Math.round(ageMs / 1000)}s, candidateAccuracy=${data.accuracy}`) // TEMPORARY

    nearby.push({
      uid: d.id,
      distanceMeters,
      accuracy: data.accuracy ?? null
    })
  })

  console.log('[Radar] final nearby matches:', nearby.length) // TEMPORARY

  return nearby.sort((a, b) => a.distanceMeters - b.distanceMeters)
}
