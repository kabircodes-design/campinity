import { useEffect, useRef, useState } from 'react'
import { useRadarLocation } from './useRadarLocation.js'
import { getRadarResults } from './radarService.js'

/**
 * ROOT CAUSE FIX for "Radar randomly stays loading": the previous
 * version's `results` fetch only ever ran inside
 * `useEffect(() => { if (!currentPosition) return; refresh() }, [...])`
 * — meaning if location permission was denied, unsupported, or errored
 * (so currentPosition can never arrive), `loading` stayed `true`
 * forever. RadarPage.jsx's own render order checked `loading` before
 * checking `status`, so a denied user saw the "Location access was
 * denied" banner AND a permanently-spinning "Scanning..." state below
 * it, with no way out.
 *
 * Results now load independently of location entirely — the campus
 * pool (radarService.js's getRadarResults) needs no GPS permission at
 * all, so `loading` resolves the moment that query returns, regardless
 * of what `status` ends up being. Location, when granted, triggers a
 * SECOND, lightweight re-fetch that merges in real distance badges —
 * it enhances the existing result set, it never gates whether results
 * load at all.
 */
export function useRadarPresence(uid, currentProfile, enabled) {
  const { status, currentPosition, error: locationError, retry: retryLocation } = useRadarLocation(uid, enabled)

  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchesError, setMatchesError] = useState('')

  // useProfile (RadarPage.jsx's caller) initializes its own profile
  // state to `null`, not `undefined` — checking `!= null` (not
  // `!== undefined`) is what actually waits for the real fetch to
  // resolve before the campus-pool query runs with a real collegeId.
  const profileReady = currentProfile != null

  const refresh = async (position) => {
    if (!uid) return
    try {
      const results = await getRadarResults(uid, currentProfile, position || currentPosition)
      setMatches(results)
      setMatchesError('')
    } catch (err) {
      setMatchesError(err?.message || 'Could not load Radar right now.')
    } finally {
      setLoading(false)
    }
  }

  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  // Campus-pool results — runs the moment we know who the user is,
  // never waits on location permission/status in any way.
  useEffect(() => {
    if (!enabled || !uid || !profileReady) return
    setLoading(true)
    refreshRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid, profileReady, currentProfile?.collegeId])

  // Location enhancement — re-runs once a fresh position actually
  // arrives, merging in real distance badges without re-triggering the
  // main loading spinner (this is a quiet enrichment, not a reload).
  useEffect(() => {
    if (!enabled || !uid || !currentPosition) return
    refreshRef.current(currentPosition)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid, currentPosition?.lat, currentPosition?.lng])

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
    matchesError,
    retryLocation,
    retryMatches: () => refresh()
  }
}
