import { useEffect, useRef, useState } from 'react'
import { useRadarLocation } from './useRadarLocation.js'
import { getNearbyMatches } from './radarService.js'

const REFRESH_INTERVAL_MS = 15000 // matches radarLocationService.js's own write-throttle interval — no point re-querying more often than the underlying data can actually change

/**
 * Combines live location watching (useRadarLocation) with periodic
 * re-fetching of physically-nearby matches — a geohash-prefix query
 * has no live onSnapshot equivalent that cleanly handles a moving
 * query center, so this re-runs getNearbyMatches on an interval tied
 * to the same cadence as the location write-throttle, plus
 * immediately whenever a first position becomes available.
 */
export function useRadarPresence(uid, currentProfile, enabled) {
  const { status, currentPosition, error: locationError } = useRadarLocation(uid, enabled)

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchesError, setMatchesError] = useState('')

  const intervalRef = useRef(null)

  const refresh = async () => {
    if (!uid || !currentPosition) return
    try {
      const results = await getNearbyMatches(uid, currentProfile, currentPosition.lat, currentPosition.lng)
      setMatches(results)
      setMatchesError('')
    } catch (err) {
      setMatchesError(err?.message || 'Could not find nearby students.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentPosition) return undefined
    refresh()

    intervalRef.current = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, currentPosition?.lat, currentPosition?.lng])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      setMatches([])
    }
  }, [enabled])

  return {
    status,
    currentPosition,
    locationError,
    matches,
    loading: enabled && loading,
    matchesError
  }
}
