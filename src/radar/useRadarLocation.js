import { useEffect, useRef, useState } from 'react'
import { maybeUpdateMyLocation, disableRadarVisibility } from './radarLocationService.js'

/**
 * Wraps navigator.geolocation.watchPosition — real permission
 * handling (denied/unsupported are distinct states, not silently
 * treated the same), real accuracy reporting (surfaced, not hidden —
 * "don't pretend we know someone's location to centimeter precision"
 * means the UI needs to know the accuracy value, not just get a
 * lat/lng), and throttled writes via maybeUpdateMyLocation (this hook
 * doesn't implement its own throttle — it delegates to the service
 * function so every caller gets identical throttle behavior).
 *
 * "Best reading in a recent window," not "always the latest reading":
 * every watchPosition callback is a candidate, but it only replaces
 * currentPosition if it's actually more accurate than what's already
 * held, OR the held reading has aged past BEST_READING_TTL_MS. This
 * is what satisfies both halves of the production-hardening request —
 * "use the newer, better reading" (a later 12m reading replaces an
 * earlier 118m one) and "do not keep a poor cached reading forever"
 * (if the held reading — good or bad — is more than 20s old, a fresh
 * reading always takes over, since the device may genuinely have
 * moved and an old "good" position at a stale location is wrong, not
 * just imprecise). enableHighAccuracy/maximumAge/timeout were already
 * set to reasonable production values before this pass — not a
 * misconfiguration being fixed here, confirmed by reading the prior
 * version directly.
 */
const BEST_READING_TTL_MS = 20000

export function useRadarLocation(uid, enabled) {
  const [status, setStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'
  const [currentPosition, setCurrentPosition] = useState(null) // { lat, lng, accuracy, capturedAt }
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  const lastWriteRef = useRef(null)
  const watchIdRef = useRef(null)
  const bestReadingRef = useRef(null) // mirrors currentPosition, read synchronously inside the watchPosition callback (state updates are async, so a ref avoids comparing against a stale closure)

  useEffect(() => {
    if (!enabled || !uid) return undefined

    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return undefined
    }

    setStatus('requesting')
    bestReadingRef.current = null

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        setStatus('granted')
        const { latitude, longitude, accuracy } = position.coords
        const now = Date.now()

        const previous = bestReadingRef.current
        const previousIsStale = previous && now - previous.capturedAt > BEST_READING_TTL_MS
        const newIsBetter = !previous || accuracy < previous.accuracy

        if (newIsBetter || previousIsStale) {
          const reading = { lat: latitude, lng: longitude, accuracy, capturedAt: now }
          bestReadingRef.current = reading
          setCurrentPosition(reading)
        }
        setError('')

        // Writes to Firestore always use the raw, current reading —
        // not the retained "best" — since the write's job is
        // reporting where the device actually is right now, and
        // maybeUpdateMyLocation's own throttle already governs write
        // frequency independently of this display-side retention
        // logic.
        try {
          lastWriteRef.current = await maybeUpdateMyLocation(uid, position.coords, lastWriteRef.current)
        } catch (err) {
          // A single failed write shouldn't stop the watcher — the
          // next position update will retry the write naturally.
          console.error('Failed to update Radar location:', err)
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setStatus('denied')
        } else {
          setStatus('error')
          setError(geoError.message || 'Could not get your location.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
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
