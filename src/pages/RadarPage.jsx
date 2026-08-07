import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { subscribeToRadarMatches } from '../radar/radarService.js'
import RadarScanner from '../radar/RadarScanner.jsx'
import RadarProfileSheet from '../radar/RadarProfileSheet.jsx'

/**
 * Complete redesign — "People You May Know" is gone entirely (was a
 * separate list; every real signal it used — course, year, mutual
 * followers, mutual communities — is now folded into the radar's own
 * scoring, not lost, just unified into one experience instead of two
 * lists). The old flat "Nearby Students" horizontal scroll is also
 * gone, replaced by the animated scanner.
 *
 * Filters are client-side over the already-fetched match list — no
 * new Firestore query per filter change, which is what makes
 * "changing filters should animate, not reload" true rather than
 * aspirational.
 *
 * Online-only filter is NOT implemented — no presence infrastructure
 * exists anywhere in this project (same gap flagged for messaging,
 * sharing, and the original Radar build). Not shown as a fake toggle
 * that would silently do nothing.
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

  const [myProfile, setMyProfile] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [activeFilters, setActiveFilters] = useState([])
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!currentUid) {
      setLoading(false)
      return undefined
    }
    let profileCancelled = false
    getUserProfile(currentUid).then((profile) => {
      if (!profileCancelled) setMyProfile(profile)
    })

    let unsubscribe = () => {}
    let previousUids = new Set()

    getUserProfile(currentUid).then((profile) => {
      if (profileCancelled) return
      unsubscribe = subscribeToRadarMatches(currentUid, profile, (data) => {
        const newUids = data.filter((m) => !previousUids.has(m.uid))
        if (previousUids.size > 0 && newUids.length > 0) {
          setToast(`New student discovered: ${newUids[0].displayName}`)
          window.setTimeout(() => setToast(''), 2500)
        }
        previousUids = new Set(data.map((m) => m.uid))
        setMatches(data)
        setLoading(false)
      })
    })

    return () => {
      profileCancelled = true
      unsubscribe()
    }
  }, [currentUid])

  const toggleFilter = (key) => {
    setActiveFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const filteredMatches = useMemo(() => {
    if (activeFilters.length === 0) return matches
    return matches.filter((m) => {
      if (activeFilters.includes('department') && m.course !== myProfile?.course) return false
      if (activeFilters.includes('year') && m.year !== myProfile?.year) return false
      if (activeFilters.includes('interests') && m.sharedInterestCount === 0) return false
      if (activeFilters.includes('verified') && !m.verifiedCampus) return false
      return true
    })
  }, [matches, activeFilters, myProfile])

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-10">
        <header className="sticky top-0 z-40 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 active:scale-95 transition-all duration-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-wide flex-1">RADAR</span>
            <button type="button" onClick={() => navigate('/search')} aria-label="Search" className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 transition-all duration-200">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="bg-gradient-to-b from-gray-900 to-gray-50 pt-8 pb-6">
          <RadarScanner matches={loading ? [] : filteredMatches} onSelectMatch={setSelectedMatch} />
        </div>

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

        <div className="px-4 mt-2">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">Scanning your campus...</p>
          ) : filteredMatches.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-900">Scanning your campus...</p>
              <p className="mt-1 text-sm text-gray-400 max-w-[260px] mx-auto leading-relaxed">
                We're looking for students around you. Invite friends to make your Radar come alive.
              </p>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-400">
              Tap an avatar on the radar to see who it is.
            </p>
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-gray-900 text-white text-xs font-medium px-4 py-2 shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <RadarProfileSheet match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}
