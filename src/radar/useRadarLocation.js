import { useEffect, useRef, useState } from 'react'
import { maybeUpdateMyLocation, disableRadarVisibility } from './radarLocationService.js'

/**
 * ONE-SHOT location by default, not continuous tracking — the prior
 * version used navigator.geolocation.watchPosition, which keeps the
 * GPS radio active continuously for as long as Radar stays open/
 * mounted, explicitly against "do not make Radar drain battery" /
 * "avoid continuous GPS tracking unless genuinely required." Since
 * Radar's primary discovery pool is now campus-based (radarService.js,
 * getRadarResults) and location is only an ENHANCEMENT layer, there is
 * no genuine need for continuous tracking — one fresh reading per
 * "session" (page open, or explicit manual refresh) is enough to
 * attach real distance badges to campus-pool results.
 *
 * getCurrentPosition still reports real accuracy (surfaced, not
 * hidden) and real permission states (denied/unsupported/error are
 * distinct, not collapsed into one generic failure) — that part of the
 * original design was already correct and is preserved as-is.
 */
export function useRadarLocation(uid, enabled) {
  const [status, setStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'
  const [currentPosition, setCurrentPosition] = useState(null) // { lat, lng, accuracy, capturedAt }
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  const lastWriteRef = useRef(null)

  useEffect(() => {
    if (!enabled || !uid) return

    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }

    let cancelled = false
    setStatus('requesting')

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return
        setStatus('granted')
        const { latitude, longitude, accuracy } = position.coords
        setCurrentPosition({ lat: latitude, lng: longitude, accuracy, capturedAt: Date.now() })
        setError('')

        try {
          lastWriteRef.current = await maybeUpdateMyLocation(uid, position.coords, lastWriteRef.current)
        } catch (err) {
          // A failed write shouldn't block the rest of Radar — the
          // campus pool (radarService.js) doesn't depend on this at
          // all; only the distance-badge enhancement is affected.
          console.error('Failed to update Radar location:', err)
        }
      },
      (geoError) => {
        if (cancelled) return
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus('denied')
        } else {
          setStatus('error')
          setError(geoError.message || 'Could not get your location.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    )

    return () => {
      cancelled = true
    }
  }, [enabled, uid, retryToken])

  // Disabling Radar removes the location document entirely, per "a
  // user who disables Radar should not appear to others" — not just
  // stopping the watcher, actually un-listing them.
  useEffect(() => {
    if (enabled || !uid) return
    disableRadarVisibility(uid).catch(() => {})
  }, [enabled, uid])

  const retry = () => setRetryToken((t) => t + 1)

  return { status, currentPosition, error, retry }
}
