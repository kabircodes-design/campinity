/**
 * The 4-tier accuracy policy — product guidance for UI messaging
 * only. NEVER used to change the 10m radius or the haversine distance
 * check itself (radarLocationService.js's RADAR_RADIUS_METERS and the
 * haversineMeters comparison are untouched by this file and don't
 * import from it) — this purely decides what the user is told about
 * their own reading's reliability.
 */
export const ACCURACY_TIERS = {
  GOOD: 'good', // <= 10m
  FAIR: 'fair', // 10-30m
  POOR: 'poor', // 30-100m
  VERY_POOR: 'very_poor' // > 100m
}

export function getAccuracyTier(accuracyMeters) {
  if (accuracyMeters == null) return null
  if (accuracyMeters <= 10) return ACCURACY_TIERS.GOOD
  if (accuracyMeters <= 30) return ACCURACY_TIERS.FAIR
  if (accuracyMeters <= 100) return ACCURACY_TIERS.POOR
  return ACCURACY_TIERS.VERY_POOR
}

/**
 * Actionable guidance — kept generic rather than claiming to detect
 * "desktop vs mobile" or "indoors vs outdoors" (this project has no
 * reliable way to detect either from the browser Geolocation API
 * alone), so every listed action is genuinely something the user can
 * try regardless of platform, not a guess presented as a diagnosis.
 */
export const ACCURACY_MESSAGES = {
  good: { title: 'Radar is active', detail: null },
  fair: {
    title: 'Location is approximate',
    detail: 'Your signal is decent but not exact — nearby distances may be off by a few meters.'
  },
  poor: {
    title: 'Location accuracy is limited',
    detail: 'Nearby matching is still running, but results may be less reliable. For a more accurate 10m Radar, try enabling high-accuracy/precise location in your device settings, or move somewhere with a clearer view of the sky.'
  },
  very_poor: {
    title: 'Low-confidence location',
    detail: 'Radar is still checking for people within 10m using your current position, but that position itself may be off by a wide margin — so a "no one nearby" result here could mean no one is actually within range, or it could mean your position estimate missed them. Enable precise location, allow location permission fully, or move outdoors for a more trustworthy result.'
  }
}
