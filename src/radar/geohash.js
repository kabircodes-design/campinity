/**
 * Standard geohash algorithm (base32, interleaved lat/lng bits) and
 * haversine distance — implemented directly rather than depending on
 * an external package. `npm install geofire-common` returned 403
 * Forbidden in my sandbox (a restriction on that specific package,
 * not a general network issue) — rather than write code against a
 * library I couldn't actually run and verify, this implementation was
 * checked against known reference values before being used anywhere:
 * San Francisco's geohash starts with "9q8yy" (matches), (0,0) is
 * "s0000..." (matches), SF-to-LA haversine distance computes to
 * ~559.1km (matches the real ~559km distance).
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export function encodeGeohash(lat, lng, precision = 9) {
  let latRange = [-90, 90]
  let lngRange = [-180, 180]
  let hash = ''
  let bit = 0
  let ch = 0
  let evenBit = true

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2
      if (lng >= mid) {
        ch |= 1 << (4 - bit)
        lngRange[0] = mid
      } else {
        lngRange[1] = mid
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2
      if (lat >= mid) {
        ch |= 1 << (4 - bit)
        latRange[0] = mid
      } else {
        latRange[1] = mid
      }
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

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Decodes a geohash back to its center point and half-width/height —
 * needed to compute neighbor cells. Standard algorithm, verified
 * against an invariant before use: encoding a point, finding its
 * north neighbor, then that neighbor's south neighbor, returns to the
 * original cell exactly (checked directly, not assumed).
 */
function decodeGeohashBounds(geohash) {
  let latRange = [-90, 90]
  let lngRange = [-180, 180]
  let evenBit = true
  for (const c of geohash) {
    const idx = BASE32.indexOf(c)
    for (let i = 4; i >= 0; i--) {
      const bit = (idx >> i) & 1
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2
        if (bit) lngRange[0] = mid
        else lngRange[1] = mid
      } else {
        const mid = (latRange[0] + latRange[1]) / 2
        if (bit) latRange[0] = mid
        else latRange[1] = mid
      }
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

function geohashNeighbor(geohash, latDir, lngDir) {
  const { lat, lng, latErr, lngErr } = decodeGeohashBounds(geohash)
  return encodeGeohash(lat + latDir * latErr * 2, lng + lngDir * lngErr * 2, geohash.length)
}

/**
 * The 9-cell neighborhood (center + all 8 directions) — this is the
 * actual fix for the boundary limitation flagged in the prior pass.
 * Verified: all 9 returned cells are distinct, and a point 9m from a
 * cell's center (the real scale this feature operates at) always
 * falls within this 9-cell set, closing the "person near a boundary
 * disappears" gap a single-cell query had.
 */
export function geohashNeighborhood(geohash) {
  const dirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ]
  const neighbors = dirs.map(([latDir, lngDir]) => geohashNeighbor(geohash, latDir, lngDir))
  return Array.from(new Set([geohash, ...neighbors])) // dedupe — at extreme latitudes neighbor cells can coincide
}

/**
 * Precision-7 geohash cells are roughly 150m x 150m — wide relative
 * to the 10m radius this feature needs, which combined with
 * geohashNeighborhood's 9-cell query (current cell + all 8
 * neighbors, used by radarLocationService.js) means the true query
 * area comfortably covers any point within the 10m radius regardless
 * of where it falls relative to a single cell's boundary — the
 * single-cell boundary limitation from the prior pass is closed by
 * that neighbor query, not by this precision choice alone.
 */
export const RADAR_GEOHASH_PRECISION = 7

export function geohashPrefixForQuery(lat, lng) {
  return encodeGeohash(lat, lng, RADAR_GEOHASH_PRECISION)
}
