import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { maybeUpdateMyLocation, disableRadarVisibility } from './radarLocationService.js'

const POSITION_OPTIONS = { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
const UNAVAILABLE_MESSAGE = "Couldn't find your location. Make sure Location is turned on for your device, then try again."
const TIMEOUT_MESSAGE = 'Finding your location took too long. Try again, ideally somewhere with better signal.'

// @capacitor/geolocation Android error codes (GeolocationErrors.kt).
const NATIVE_PERMISSION_DENIED = 'OS-PLUG-GLOC-0003'
const NATIVE_TIMEOUT = 'OS-PLUG-GLOC-0010'

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
 *
 * On Android the position comes from @capacitor/geolocation (native
 * FusedLocationProvider + native permission request) instead of the
 * WebView's navigator.geolocation. Verified on a real device that the
 * WebView path never returns a position when only Approximate location
 * is granted (Android throttles COARSE WebView requests), and reports a
 * "Don't allow" tap in the permission dialog as a TIMEOUT rather than
 * PERMISSION_DENIED. The browser path is unchanged.
 */
export function useRadarLocation(uid, enabled) {
  const [status, setStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'
  const [currentPosition, setCurrentPosition] = useState(null) // { lat, lng, accuracy, capturedAt }
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  const lastWriteRef = useRef(null)

  useEffect(() => {
    if (!enabled || !uid) return

    const isNative = Capacitor.isNativePlatform()
    if (!isNative && !('geolocation' in navigator)) {
      setStatus('unsupported')
      return
    }

    let cancelled = false
    setStatus('requesting')

    const onPosition = async (position) => {
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
    }

    if (isNative) {
      // The plugin requests permission itself (Precise or Approximate on
      // Android 12+) and proceeds if at least Approximate is granted.
      // Location-off, declined "turn on location", network-off and
      // provider errors all mean no fix is available right now.
      Geolocation.getCurrentPosition(POSITION_OPTIONS).then(onPosition, (err) => {
        if (cancelled) return
        if (err?.code === NATIVE_PERMISSION_DENIED) {
          setStatus('denied')
          return
        }
        setStatus('error')
        setError(err?.code === NATIVE_TIMEOUT ? TIMEOUT_MESSAGE : UNAVAILABLE_MESSAGE)
      })
    } else {
      navigator.geolocation.getCurrentPosition(
        onPosition,
        (geoError) => {
          if (cancelled) return
          if (geoError.code === geoError.PERMISSION_DENIED) {
            setStatus('denied')
          } else {
            // Raw WebView/browser messages ("Timeout expired", provider
            // internals) aren't user-facing; the two common real causes
            // get an actionable message instead.
            setStatus('error')
            if (geoError.code === geoError.POSITION_UNAVAILABLE) {
              setError(UNAVAILABLE_MESSAGE)
            } else if (geoError.code === geoError.TIMEOUT) {
              setError(TIMEOUT_MESSAGE)
            } else {
              setError(geoError.message || 'Could not get your location.')
            }
          }
        },
        POSITION_OPTIONS
      )
    }

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
