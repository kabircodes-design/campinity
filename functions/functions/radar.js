/**
 * Secure Radar proximity (PREPARED — not deployed).
 *
 * Today the client writes radarLocations/{uid} (exact lat/lng) and reads
 * other people's documents directly to compute distance, which means any
 * signed-in user can read anyone's exact coordinates. This callable moves
 * the whole proximity step to the server:
 *
 *   client --(own position)--> radarNearby --> [{ uid, distanceMeters }]
 *
 * - The caller's position is stored with the Admin SDK; nobody else's
 *   coordinates ever leave the server.
 * - Returned distances are rounded (never below 10 m, then to the
 *   nearest 10/50 m) — enough for "~40m away", not for triangulation.
 * - Hidden users (users.radarVisible === false) are never returned, and
 *   a hidden caller gets nothing back and has their location removed.
 * - Blocking is enforced in BOTH directions (the client can only see
 *   its own block list; the server can see both).
 * - Stale locations (> 10 min) are ignored.
 *
 * Paired with the firestore.rules change that makes radarLocations
 * owner-read-only. Rollout order is in RADAR_SECURITY_PLAN.md.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

const RADIUS_METERS = 300
const STALE_MS = 10 * 60 * 1000
// Precision-6 cells are ~1.2 km x 0.6 km, so the 3x3 neighbourhood fully
// covers the 300 m radius. (The client queries precision-7 cells,
// ~150 m, whose neighbourhood can miss people 150-300 m away.)
const QUERY_PRECISION = 6
const STORE_PRECISION = 9
const PER_CELL_LIMIT = 60
const MAX_RESULTS = 50
// Abuse resistance: one lookup per user every MIN_INTERVAL_MS. Repeated
// calls with shifting fake positions are how proximity services get used
// to triangulate people; the client refreshes far less often than this.
const MIN_INTERVAL_MS = 5000

function encodeGeohash(lat, lng, precision) {
  const latRange = [-90, 90]
  const lngRange = [-180, 180]
  let hash = ''
  let bit = 0
  let ch = 0
  let evenBit = true
  while (hash.length < precision) {
    const range = evenBit ? lngRange : latRange
    const value = evenBit ? lng : lat
    const mid = (range[0] + range[1]) / 2
    if (value >= mid) {
      ch |= 1 << (4 - bit)
      range[0] = mid
    } else {
      range[1] = mid
    }
    evenBit = !evenBit
    if (bit < 4) {
      bit++
    } else {
      hash += BASE32[ch]
      bit = 0
      ch = 0
    }
  }
  return hash
}

function decodeBounds(geohash) {
  const latRange = [-90, 90]
  const lngRange = [-180, 180]
  let evenBit = true
  for (const c of geohash) {
    const idx = BASE32.indexOf(c)
    for (let i = 4; i >= 0; i--) {
      const range = evenBit ? lngRange : latRange
      const mid = (range[0] + range[1]) / 2
      if ((idx >> i) & 1) range[0] = mid
      else range[1] = mid
      evenBit = !evenBit
    }
  }
  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lng: (lngRange[0] + lngRange[1]) / 2,
    latErr: (latRange[1] - latRange[0]) / 2,
    lngErr: (lngRange[1] - lngRange[0]) / 2
  }
}

function neighborhood(geohash) {
  const { lat, lng, latErr, lngErr } = decodeBounds(geohash)
  const cells = new Set([geohash])
  for (const dLat of [-1, 0, 1]) {
    for (const dLng of [-1, 0, 1]) {
      if (dLat || dLng) cells.add(encodeGeohash(lat + dLat * latErr * 2, lng + dLng * lngErr * 2, geohash.length))
    }
  }
  return Array.from(cells)
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Coarse public distance: >= 10 m, 10 m steps to 100 m, then 50 m steps. */
function roundDistance(meters) {
  if (meters < 100) return Math.max(10, Math.round(meters / 10) * 10)
  return Math.round(meters / 50) * 50
}

/** Validates the client-supplied position. Returns a clean object or throws a message. */
function parsePosition(data) {
  const lat = Number(data && data.lat)
  const lng = Number(data && data.lng)
  const accuracy = data && data.accuracy != null ? Number(data.accuracy) : null
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('Invalid latitude.')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('Invalid longitude.')
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)) throw new Error('Invalid accuracy.')
  return { lat, lng, accuracy }
}

/**
 * Pure filter, unit-tested without Firestore. `candidates` are location
 * docs ({ uid, lat, lng, updatedAtMs }); `isExcluded(uid)` covers
 * hidden + blocked either way.
 */
function selectNearby({ callerUid, lat, lng, nowMs, candidates, isExcluded }) {
  const seen = new Set()
  const results = []
  for (const c of candidates) {
    if (!c || c.uid === callerUid || seen.has(c.uid)) continue
    seen.add(c.uid)
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue
    if (!c.updatedAtMs || nowMs - c.updatedAtMs > STALE_MS) continue
    const distance = haversineMeters(lat, lng, c.lat, c.lng)
    if (distance > RADIUS_METERS) continue
    if (isExcluded(c.uid)) continue
    results.push({ uid: c.uid, distanceMeters: roundDistance(distance), raw: distance })
  }
  return results
    .sort((a, b) => a.raw - b.raw)
    .slice(0, MAX_RESULTS)
    .map(({ uid, distanceMeters }) => ({ uid, distanceMeters }))
}

/**
 * Callable handler factory — takes the Admin Firestore instance and the
 * FieldValue/HttpsError helpers so it can be exercised in tests.
 */
function makeRadarNearbyHandler({ db, FieldValue, HttpsError, now = () => Date.now() }) {
  return async (request) => {
    const callerUid = request.auth && request.auth.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in to use Radar.')

    let position
    try {
      position = parsePosition(request.data)
    } catch (err) {
      throw new HttpsError('invalid-argument', err.message)
    }

    const callerSnap = await db.collection('users').doc(callerUid).get()
    const caller = callerSnap.exists ? callerSnap.data() : null
    if (!caller) throw new HttpsError('failed-precondition', 'Profile not found.')

    const locationRef = db.collection('radarLocations').doc(callerUid)
    const previous = await locationRef.get()
    const previousMs = previous.exists && previous.data().updatedAt && previous.data().updatedAt.toMillis ? previous.data().updatedAt.toMillis() : 0
    if (previousMs && now() - previousMs < MIN_INTERVAL_MS && caller.radarVisible !== false) {
      throw new HttpsError('resource-exhausted', 'Radar is refreshing too often. Try again in a few seconds.')
    }
    if (caller.radarVisible === false) {
      // Hidden: make sure nothing of theirs stays queryable.
      await locationRef.delete().catch(() => {})
      return { nearby: [] }
    }

    await locationRef.set({
      geohash: encodeGeohash(position.lat, position.lng, STORE_PRECISION),
      lat: position.lat,
      lng: position.lng,
      accuracy: position.accuracy,
      updatedAt: FieldValue.serverTimestamp()
    })

    const cells = neighborhood(encodeGeohash(position.lat, position.lng, QUERY_PRECISION))
    const snaps = await Promise.all(
      cells.map((cell) =>
        db.collection('radarLocations').where('geohash', '>=', cell).where('geohash', '<=', cell + '\uf8ff').limit(PER_CELL_LIMIT).get()
      )
    )
    const candidates = []
    snaps.forEach((snap) =>
      snap.docs.forEach((d) => {
        const data = d.data()
        candidates.push({ uid: d.id, lat: data.lat, lng: data.lng, updatedAtMs: data.updatedAt && data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0 })
      })
    )

    // Exclusions need both directions of blocking plus each candidate's
    // own visibility — read only for candidates that are actually in range.
    const nowMs = now()
    const inRange = selectNearby({ callerUid, ...position, nowMs, candidates, isExcluded: () => false })
    const excluded = new Set()
    await Promise.all(
      inRange.map(async ({ uid }) => {
        const [profile, iBlocked, theyBlocked] = await Promise.all([
          db.collection('users').doc(uid).get(),
          db.collection('users').doc(callerUid).collection('blockedUsers').doc(uid).get(),
          db.collection('users').doc(uid).collection('blockedUsers').doc(callerUid).get()
        ])
        if (!profile.exists || profile.data().radarVisible === false || iBlocked.exists || theyBlocked.exists) excluded.add(uid)
      })
    )

    const nearby = selectNearby({ callerUid, ...position, nowMs, candidates, isExcluded: (uid) => excluded.has(uid) })
    return { nearby }
  }
}

module.exports = {
  makeRadarNearbyHandler,
  selectNearby,
  parsePosition,
  roundDistance,
  encodeGeohash,
  neighborhood,
  haversineMeters,
  RADIUS_METERS,
  STALE_MS,
  MIN_INTERVAL_MS
}
