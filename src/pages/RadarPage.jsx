import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, MapPin, AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { auth } from '../firebase/firebase.js'
import { useProfile } from '../radar/useProfileOnce.js'
import { useRadarPresence } from '../radar/useRadarPresence.js'
import RadarScanner from '../radar/RadarScanner.jsx'
import RadarProfileSheet from '../radar/RadarProfileSheet.jsx'

/**
 * Rewired for real physical proximity — see radarService.js's own
 * comment for the full root-cause explanation. This page now surfaces
 * permission state and GPS accuracy honestly instead of hiding them:
 * a denied/unsupported/poor-accuracy state gets its own real message,
 * not the same empty state as "no one nearby."
 */
const FILTERS = [
  { key: 'department', label: 'Same Department' },
  { key: 'year', label: 'Same Year' },
  { key: 'interests', label: 'Shared Interests' },
  { key: 'verified', label: 'Verified' }
]

const POOR_ACCURACY_THRESHOLD_METERS = 50
const SEVERE_ACCURACY_THRESHOLD_METERS = 100 // beyond this, the device genuinely cannot distinguish "5m away" from "95m away" — showing a match list at all would be pretending precision that doesn't exist

export default function RadarPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid
  const { profile: myProfile } = useProfile(currentUid)

  const [radarEnabled, setRadarEnabled] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [activeFilters, setActiveFilters] = useState([])

  const { status, currentPosition, locationError, matches, loading, matchesError } = useRadarPresence(
    currentUid,
    myProfile,
    radarEnabled
  )

  const toggleFilter = (key) => {
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const filteredMatches = matches.filter((m) => {
    if (activeFilters.includes('department') && m.course !== myProfile?.course) return false
    if (activeFilters.includes('year') && m.year !== myProfile?.year) return false
    if (activeFilters.includes('interests') && m.sharedInterestCount === 0) return false
    if (activeFilters.includes('verified') && !m.verifiedCampus) return false
    return true
  })

  const poorAccuracy = currentPosition?.accuracy != null && currentPosition.accuracy > POOR_ACCURACY_THRESHOLD_METERS
  const severeAccuracy = currentPosition?.accuracy != null && currentPosition.accuracy > SEVERE_ACCURACY_THRESHOLD_METERS
  const effectiveMatches = severeAccuracy ? [] : filteredMatches

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-10">
        <header className="sticky top-0 z-40 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 active:scale-95 transition-all duration-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-wide flex-1">RADAR</span>
            <button
              type="button"
              onClick={() => setRadarEnabled((v) => !v)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-300 ${
                radarEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/60'
              }`}
            >
              {radarEnabled ? 'Visible' : 'Hidden'}
            </button>
            <button type="button" onClick={() => navigate('/search')} aria-label="Search" className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 transition-all duration-200">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </header>

        {status === 'denied' && (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
            <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-amber-800">
              Location access was denied. Enable it in your browser settings to see who's nearby.
            </p>
          </div>
        )}
        {status === 'unsupported' && (
          <div className="mx-4 mt-3 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-3">
            <p className="text-[12.5px] text-gray-600">Your browser doesn't support location — Radar needs it to work.</p>
          </div>
        )}
        {status === 'error' && locationError && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
            <p className="text-[12.5px] text-red-600">{locationError}</p>
          </div>
        )}
        {poorAccuracy && status === 'granted' && (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-amber-800">
              {severeAccuracy
                ? `Your location signal is too weak (±${Math.round(currentPosition.accuracy)}m) to show nearby people accurately — hidden until your signal improves.`
                : `Your location signal is weak (±${Math.round(currentPosition.accuracy)}m) — nearby results may not be precise right now.`}
            </p>
          </div>
        )}

        <div className="bg-gradient-to-b from-gray-900 to-gray-50 pt-8 pb-6">
          <RadarScanner matches={loading ? [] : effectiveMatches} onSelectMatch={setSelectedMatch} />
        </div>

        {radarEnabled && status === 'granted' && (
          <div className="px-4 -mt-2 flex items-center gap-2 overflow-x-auto scroll-hidden pb-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFilter(f.key)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                  activeFilters.includes(f.key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 mt-2">
          {!radarEnabled ? (
            <p className="text-center text-sm text-gray-400 py-8">Radar is hidden — you're not visible to others either.</p>
          ) : status === 'requesting' || status === 'idle' ? (
            <p className="text-center text-sm text-gray-400 py-8">Requesting location access...</p>
          ) : loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Scanning your campus...</p>
          ) : matchesError ? (
            <p className="text-center text-sm text-gray-400 py-8">{matchesError}</p>
          ) : effectiveMatches.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-900">No one nearby right now.</p>
              <p className="mt-1 text-sm text-gray-400 max-w-[260px] mx-auto leading-relaxed">
                We're scanning a 10m radius around you. Move around or check back soon.
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400">Tap an avatar on the radar to see who it is.</p>
          )}
        </div>
      </div>

      <RadarProfileSheet match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}
