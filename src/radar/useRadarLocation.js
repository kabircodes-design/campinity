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
 */
export function useRadarLocation(uid, enabled) {
  const [status, setStatus] = useState('idle') // 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error'
  const [currentPosition, setCurrentPosition] = useState(null) // { lat, lng, accuracy }
  const [error, setError] = useState('')

  const lastWriteRef = useRef(null)
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!enabled || !uid) return undefined

    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      return undefined
    }

    setStatus('requesting')

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        setStatus('granted')
        const { latitude, longitude, accuracy } = position.coords
        setCurrentPosition({ lat: latitude, lng: longitude, accuracy })
        setError('')

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
  }, [enabled, uid])

  // Disabling Radar removes the location document entirely, per "a
  // user who disables Radar should not appear to others" — not just
  // stopping the watcher, actually un-listing them.
  useEffect(() => {
    if (enabled || !uid) return
    disableRadarVisibility(uid).catch(() => {})
  }, [enabled, uid])

  return { status, currentPosition, error }
}
