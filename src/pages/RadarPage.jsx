import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Info, MapPin, MapPinOff, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { updateUserProfile } from '../firebase/profileService.js'
import { useProfile } from '../radar/useProfileOnce.js'
import { useRadarPresence } from '../radar/useRadarPresence.js'
import RadarScanner from '../radar/RadarScanner.jsx'
import RadarUserCard from '../radar/RadarUserCard.jsx'
import RadarProfileSheet from '../radar/RadarProfileSheet.jsx'
import { getAccuracyTier, ACCURACY_MESSAGES } from '../radar/accuracyPolicy.js'

/**
 * Radar — campus discovery, with physical proximity as an optional
 * enhancement (see radarService.getRadarResults / useRadarPresence for
 * the data layer, unchanged here).
 *
 * Visibility is now a saved preference (users/{uid}.radarVisible,
 * absent = visible). Before, the Visible/Hidden switch was page-local
 * state that reset to Visible on every visit, and "Hidden" only removed
 * the location document — the person still appeared in everyone else's
 * campus list. Now Hidden is remembered and radarService skips hidden
 * people entirely. While the saved choice is loading, Radar neither
 * starts location nor deletes anything (`enabled === null`).
 *
 * Privacy: only rounded distances are ever shown ("~40m away");
 * coordinates never reach the UI.
 */
const FILTERS = [
  { key: 'department', label: 'Same department' },
  { key: 'year', label: 'Same year' },
  { key: 'interests', label: 'Shared interests' },
  { key: 'verified', label: 'Verified' }
]

function LocationStatus({ status, accuracy }) {
  if (status === 'granted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 text-emerald-300 text-[11px] font-semibold px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Location on{accuracy ? ` · ±${Math.round(accuracy)}m` : ''}
      </span>
    )
  }
  if (status === 'denied' || status === 'unsupported' || status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white/70 text-[11px] font-semibold px-2.5 py-1">
        <MapPinOff className="w-3 h-3" /> Campus only
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white/70 text-[11px] font-semibold px-2.5 py-1">
      <MapPin className="w-3 h-3" /> Finding your location…
    </span>
  )
}

export default function RadarPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid
  const { profile: myProfile, loading: profileLoading } = useProfile(currentUid)

  const [visibilityOverride, setVisibilityOverride] = useState(null)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityError, setVisibilityError] = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [activeFilters, setActiveFilters] = useState([])

  // null while the saved preference loads; then true/false.
  const radarEnabled = profileLoading ? null : visibilityOverride ?? (myProfile?.radarVisible !== false)

  const { status, currentPosition, locationError, matches, loading, matchesError, retryLocation, retryMatches } = useRadarPresence(
    currentUid,
    myProfile,
    radarEnabled
  )

  const toggleVisibility = async () => {
    if (radarEnabled === null || visibilitySaving || !currentUid) return
    const next = !radarEnabled
    setVisibilityOverride(next)
    setVisibilitySaving(true)
    setVisibilityError('')
    try {
      await updateUserProfile(currentUid, { radarVisible: next })
    } catch {
      setVisibilityOverride(!next)
      setVisibilityError("Couldn't save your Radar visibility. Please try again.")
    } finally {
      setVisibilitySaving(false)
    }
  }

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
  const nearbyCount = filteredMatches.filter((m) => m.distanceMeters != null).length

  const accuracyTier = getAccuracyTier(currentPosition?.accuracy)
  const accuracyMessage = accuracyTier ? ACCURACY_MESSAGES[accuracyTier] : null
  const showLoading = radarEnabled === null || loading

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-white lg:bg-gray-50">
      <div className="mx-auto max-w-[560px] lg:max-w-[1100px] pb-10">
        {/* Header */}
        <header className="px-4 lg:px-6 pt-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-1 min-w-0">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-10 h-10 -ml-2 mt-[-2px] flex-shrink-0 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Radar</h1>
              <p className="mt-0.5 text-[13px] text-gray-500">Discover students around your campus</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/search')}
            aria-label="Search people"
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all duration-200"
          >
            <Search className="w-5 h-5" />
          </button>
        </header>

        <div className="lg:px-6 lg:mt-4 lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">
          <div className="lg:sticky lg:top-4 space-y-3 mt-4 lg:mt-0">
            {/* Scanner card */}
            <section className="mx-4 lg:mx-0 rounded-3xl overflow-hidden bg-gradient-to-b from-gray-900 to-[#111827] text-white">
              <div className="px-4 pt-4 flex items-center justify-between gap-2">
                <LocationStatus status={radarEnabled ? status : null} accuracy={currentPosition?.accuracy} />
                {radarEnabled && !showLoading && (
                  <button
                    type="button"
                    onClick={() => retryMatches()}
                    aria-label="Refresh Radar"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:bg-white/10 active:scale-95 transition-all duration-200"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex justify-center py-4">
                <RadarScanner matches={radarEnabled && !showLoading ? filteredMatches : []} onSelectMatch={setSelectedMatch} size={260} />
              </div>
              <div className="px-4 pb-4 text-center">
                <p className="text-[15px] font-semibold">
                  {radarEnabled === false
                    ? 'Radar is paused'
                    : showLoading
                      ? 'Scanning your campus…'
                      : `${filteredMatches.length} ${filteredMatches.length === 1 ? 'person' : 'people'} to discover`}
                </p>
                <p className="mt-0.5 text-xs text-white/60">
                  {radarEnabled === false
                    ? 'Turn visibility on to discover and be discovered.'
                    : nearbyCount > 0
                      ? `${nearbyCount} nearby right now · tap a dot to view`
                      : 'Distances appear when people near you share location.'}
                </p>
              </div>
            </section>

            {/* Visibility */}
            <section className="mx-4 lg:mx-0 rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${radarEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  {radarEnabled === false ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Visible on Radar</p>
                  <p className="text-xs text-gray-500 leading-snug">
                    {radarEnabled === false ? "You're hidden. Others can't find you here." : 'Students on your campus can discover you.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={radarEnabled === true}
                  aria-label="Visible on Radar"
                  disabled={radarEnabled === null || visibilitySaving}
                  onClick={toggleVisibility}
                  className={`relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200 disabled:opacity-60 ${radarEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  {/* Inline white: the theme remaps `bg-white` to the dark
                      surface in Dark Mode, and a switch knob must stay white. */}
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full shadow transition-transform duration-200 ${radarEnabled ? 'translate-x-5' : ''}`}
                    style={{ backgroundColor: '#ffffff' }}
                  />
                </button>
              </div>
              {visibilityError && <p role="alert" className="mt-2 text-xs text-red-600">{visibilityError}</p>}
              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-gray-400 leading-snug">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                Only an approximate distance is shown here — never anyone's exact location. People you've blocked don't appear.
              </p>
            </section>

            {/* Filters */}
            {radarEnabled && (
              <div className="-mx-0 px-4 lg:px-0 flex lg:flex-wrap items-center gap-2 overflow-x-auto lg:overflow-visible scroll-hidden" role="group" aria-label="Filters">
                {FILTERS.map((f) => {
                  const isActive = activeFilters.includes(f.key)
                  return (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => toggleFilter(f.key)}
                      className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                        isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-4 lg:px-0 mt-4 lg:mt-0 space-y-3">
            {/* Location notices */}
            {radarEnabled && status === 'denied' && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-amber-800 leading-snug">
                    Location is off — you'll still see people from your campus. Turn it on to also see who's physically nearby.
                    {Capacitor.isNativePlatform() && " If no prompt appears, allow Location for Campinity in your phone's Settings → Apps."}
                  </p>
                </div>
                <button type="button" onClick={retryLocation} className="mt-2 ml-6 text-[13px] font-semibold text-amber-800 underline underline-offset-2">
                  Turn on location
                </button>
              </div>
            )}
            {radarEnabled && status === 'unsupported' && (
              <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
                <p className="text-[13px] text-gray-600">This device can't share location — you'll still see people from your campus, just without distance.</p>
              </div>
            )}
            {radarEnabled && status === 'error' && locationError && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-[13px] text-red-700">{locationError}</p>
                <button type="button" onClick={retryLocation} className="mt-2 text-[13px] font-semibold text-red-700 underline underline-offset-2">
                  Try again
                </button>
              </div>
            )}
            {radarEnabled && accuracyMessage && accuracyTier !== 'good' && status === 'granted' && (
              <div
                className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 ${
                  accuracyTier === 'very_poor' ? 'bg-red-50 border-red-200' : accuracyTier === 'poor' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                }`}
              >
                {accuracyTier === 'fair' ? (
                  <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${accuracyTier === 'very_poor' ? 'text-red-600' : 'text-amber-600'}`} />
                )}
                <div>
                  <p className={`text-[13px] font-semibold ${accuracyTier === 'very_poor' ? 'text-red-800' : accuracyTier === 'poor' ? 'text-amber-800' : 'text-blue-800'}`}>
                    {accuracyMessage.title} (±{Math.round(currentPosition.accuracy)}m)
                  </p>
                  <p className={`text-[12px] mt-0.5 ${accuracyTier === 'very_poor' ? 'text-red-700' : accuracyTier === 'poor' ? 'text-amber-700' : 'text-blue-700'}`}>
                    Distances may be less precise, but discovery itself isn't affected.
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {radarEnabled === false ? (
              <div className="py-12 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center">
                  <EyeOff className="w-6 h-6" />
                </div>
                <p className="mt-3 text-[15px] font-semibold text-gray-900">You're hidden from Radar</p>
                <p className="mt-1 text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                  Your location isn't shared and you don't appear to others. Turn visibility back on whenever you like.
                </p>
              </div>
            ) : showLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading people">
                {Array.from({ length: 4 }).map((_, i) => (
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
              <div className="py-12 text-center">
                <p className="text-[15px] font-semibold text-gray-900">Couldn't load Radar</p>
                <p className="mt-1 text-sm text-gray-500">Check your connection and try again.</p>
                <button type="button" onClick={retryMatches} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2">
                  <RefreshCw className="w-4 h-4" /> Try again
                </button>
              </div>
            ) : filteredMatches.length === 0 && matches.length > 0 ? (
              <div className="py-12 text-center">
                <p className="text-[15px] font-semibold text-gray-900">No one matches these filters</p>
                <button type="button" onClick={() => setActiveFilters([])} className="mt-3 text-sm font-semibold text-blue-600">
                  Clear filters
                </button>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <p className="mt-3 text-[15px] font-semibold text-gray-900">No one to discover yet</p>
                <p className="mt-1 text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                  {myProfile?.collegeId
                    ? 'No other students from your campus are visible right now — check back soon.'
                    : 'Add your college to your profile to start discovering people on your campus.'}
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-[15px] font-bold text-gray-900">{nearbyCount > 0 ? 'Nearby first' : 'On your campus'}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredMatches.map((match) => (
                    <RadarUserCard key={match.uid} match={match} onOpen={setSelectedMatch} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <RadarProfileSheet match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}
