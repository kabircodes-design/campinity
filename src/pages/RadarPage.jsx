import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, MapPin, AlertTriangle, Info, RefreshCw } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { useProfile } from '../radar/useProfileOnce.js'
import { useRadarPresence } from '../radar/useRadarPresence.js'
import RadarScanner from '../radar/RadarScanner.jsx'
import RadarUserCard from '../radar/RadarUserCard.jsx'
import RadarProfileSheet from '../radar/RadarProfileSheet.jsx'
import { getAccuracyTier, ACCURACY_MESSAGES } from '../radar/accuracyPolicy.js'

/**
 * ROOT CAUSE of "Radar is unreliable," traced end to end (route ->
 * mount -> auth -> profile -> location -> query -> filter -> render):
 * an earlier pass made physical GPS proximity, gated at a 15-meter
 * radius, the ONLY discovery mechanism — tighter than typical browser
 * Geolocation accuracy (often 20-100m+, worse indoors/on laptops), so
 * two real people standing near each other routinely failed to match,
 * and there was no fallback of any kind when location was denied,
 * unavailable, or simply imprecise. A second, compounding bug:
 * useRadarPresence's loading flag only ever resolved once a GPS
 * position arrived — for a denied/unsupported/errored user, it never
 * did, so the page showed a permanent "Scanning..." spinner beneath
 * the very banner explaining why nothing would ever load.
 *
 * Both are fixed at the data layer (radarService.js's getRadarResults,
 * useRadarPresence.js) — this page's job is now just to render
 * whatever that layer reports honestly: campus discovery always
 * works, location is a real but optional enhancement, and every
 * failure state (denied / unsupported / error / genuinely empty) gets
 * its own message, never collapsed into a generic "no one nearby."
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

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[1100px] bg-white lg:bg-transparent min-h-screen lg:shadow-none shadow-sm pb-10">
        <header className="sticky top-0 z-40 bg-gradient-to-br from-gray-900 to-gray-800 text-white lg:rounded-b-2xl">
          <div className="mx-auto max-w-[1100px] h-14 flex items-center gap-2 px-3 lg:px-6">
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

        <div className="mx-auto max-w-[1100px] lg:px-6">
          {status === 'denied' && (
            <div className="mx-4 lg:mx-0 mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-amber-800">
                  Location access is off — you're still discoverable to people on your campus. Enable location to also see who's
                  physically nearby.
                </p>
              </div>
              <button type="button" onClick={retryLocation} className="mt-2 ml-6 text-xs font-semibold text-amber-800 underline underline-offset-2">
                Turn on location
              </button>
            </div>
          )}
          {status === 'unsupported' && (
            <div className="mx-4 lg:mx-0 mt-3 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-3">
              <p className="text-[12.5px] text-gray-600">
                Your browser doesn't support location — you'll still see people from your campus, just without distance.
              </p>
            </div>
          )}
          {status === 'error' && locationError && (
            <div className="mx-4 lg:mx-0 mt-3 rounded-xl bg-red-50 border border-red-200 px-3.5 py-3">
              <p className="text-[12.5px] text-red-600">{locationError}</p>
              <button type="button" onClick={retryLocation} className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2">
                Try Again
              </button>
            </div>
          )}
          {accuracyMessage && accuracyTier !== 'good' && status === 'granted' && (
            <div
              className={`mx-4 lg:mx-0 mt-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
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
                  Distance badges may be less precise, but discovery itself isn't affected.
                </p>
              </div>
            </div>
          )}

          <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-6 lg:mt-4 lg:items-start">
            <div className="lg:sticky lg:top-20">
              <div className="bg-gradient-to-b from-gray-900 to-gray-50 lg:rounded-2xl pt-8 pb-6 lg:pb-8">
                <RadarScanner matches={loading ? [] : filteredMatches} onSelectMatch={setSelectedMatch} size={280} />
              </div>

              {radarEnabled && (
                <div className="px-4 lg:px-0 -mt-2 lg:mt-3 flex lg:flex-wrap items-center gap-2 overflow-x-auto lg:overflow-visible scroll-hidden pb-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => toggleFilter(f.key)}
                      className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                        activeFilters.includes(f.key) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 lg:px-0 mt-2 lg:mt-0">
              {!radarEnabled ? (
                <p className="text-center text-sm text-gray-400 py-16">Radar is hidden — you're not visible to others either.</p>
              ) : loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-100" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-2/3 rounded bg-gray-100" />
                          <div className="h-2.5 w-1/2 rounded bg-gray-100" />
                        </div>
                      </div>
                      <div className="mt-4 h-8 rounded-full bg-gray-100" />
                    </div>
                  ))}
                </div>
              ) : matchesError ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900">Couldn't load Radar</p>
                  <p className="mt-1 text-sm text-gray-400">{matchesError}</p>
                  <button type="button" onClick={retryMatches} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                    <RefreshCw className="w-3.5 h-3.5" /> Try Again
                  </button>
                </div>
              ) : filteredMatches.length === 0 && matches.length > 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900">No one matches these filters</p>
                  <p className="mt-1 text-sm text-gray-400">Try removing a filter to see more people.</p>
                </div>
              ) : filteredMatches.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-semibold text-gray-900">No one to discover yet</p>
                  <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                    {myProfile?.collegeId
                      ? "We couldn't find other students on your campus right now — check back soon."
                      : 'Add your college to your profile to start discovering people on your campus.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredMatches.map((match) => (
                    <RadarUserCard key={match.uid} match={match} onOpen={setSelectedMatch} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <RadarProfileSheet match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}
