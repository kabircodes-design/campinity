import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, MapPin, AlertTriangle, Info } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { auth } from '../firebase/firebase.js'
import { useProfile } from '../radar/useProfileOnce.js'
import { useRadarPresence } from '../radar/useRadarPresence.js'
import RadarScanner from '../radar/RadarScanner.jsx'
import RadarProfileSheet from '../radar/RadarProfileSheet.jsx'
import { getAccuracyTier, ACCURACY_MESSAGES } from '../radar/accuracyPolicy.js'

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

export default function RadarPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid
  const { profile: myProfile } = useProfile(currentUid)

  const [radarEnabled, setRadarEnabled] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [activeFilters, setActiveFilters] = useState([])

  const { status, currentPosition, locationError, matches, loading, matchesError, retryLocation, retryMatches } = useRadarPresence(
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

  const accuracyTier = getAccuracyTier(currentPosition?.accuracy)
  const accuracyMessage = accuracyTier ? ACCURACY_MESSAGES[accuracyTier] : null
  const effectiveMatches = filteredMatches // never gated by accuracy tier — the 10m haversine check in radarLocationService.js is the only distance decision that exists

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
          <div className="mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-amber-800">
                Location access was denied. Enable it in your browser settings to see who's nearby.
              </p>
            </div>
            <button
              type="button"
              onClick={retryLocation}
              className="mt-2 ml-6 text-xs font-semibold text-amber-800 underline underline-offset-2"
            >
              Try Again
            </button>
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
            <button
              type="button"
              onClick={retryLocation}
              className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2"
            >
              Try Again
            </button>
          </div>
        )}
        {accuracyMessage && accuracyTier !== 'good' && status === 'granted' && (
          <div
            className={`mx-4 mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
              accuracyTier === 'very_poor' ? 'bg-red-50 border-red-200' : accuracyTier === 'poor' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
            }`}
          >
            {accuracyTier === 'fair' ? (
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${accuracyTier === 'very_poor' ? 'text-red-600' : 'text-amber-600'}`} />
            )}
            <div>
              <p className={`text-[12.5px] font-semibold ${accuracyTier === 'very_poor' ? 'text-red-800' : accuracyTier === 'poor' ? 'text-amber-800' : 'text-blue-800'}`}>
                {accuracyMessage.title} (±{Math.round(currentPosition.accuracy)}m)
              </p>
              <p className={`text-[12px] mt-0.5 ${accuracyTier === 'very_poor' ? 'text-red-700' : accuracyTier === 'poor' ? 'text-amber-700' : 'text-blue-700'}`}>
                {accuracyMessage.detail}
              </p>
            </div>
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
            <div className="flex flex-col items-center py-8 gap-2">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Requesting location access...</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Scanning your campus...</p>
            </div>
          ) : matchesError ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">{matchesError}</p>
              <button type="button" onClick={retryMatches} className="mt-2 text-xs font-semibold text-blue-600 underline underline-offset-2">
                Try Again
              </button>
            </div>
          ) : effectiveMatches.length === 0 && (accuracyTier === 'poor' || accuracyTier === 'very_poor') ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-900">Can't confirm nearby people right now.</p>
              <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                No one showed up within 10m of your current position — but that position itself is uncertain
                (±{currentPosition?.accuracy ? Math.round(currentPosition.accuracy) : '?'}m), so this isn't the same
                as confirming no one is actually nearby. Improve your location accuracy for a reliable result.
              </p>
            </div>
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
