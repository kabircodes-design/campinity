import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Sparkles, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import CommunityCard from '../components/CommunityCard.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile, getNearbyStudents, getPeopleYouMayKnow } from '../firebase/profileService.js'
import { getTrendingCommunities } from '../firebase/communityService.js'

/**
 * Every section here is backed by real data or explicitly marked as
 * not yet available — nothing is faked. "Nearby Students" and "People
 * You May Know" use real profile fields (collegeId, courseLower,
 * yearLower). "Discover" reuses getTrendingCommunities, the same
 * function HomePage's Clubs tab and SearchPage already use — not a
 * new implementation. Campus Pulse and Live Activity are NOT rendered
 * with fabricated numbers — "120 students online" or "14 in Library"
 * would need real presence/check-in infrastructure that doesn't exist
 * anywhere in this project (the same gap already flagged for the
 * messaging system's typing/online indicators). Shown as a real,
 * honest "coming soon" note instead of decorated with fake data.
 */
export default function RadarPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [myProfile, setMyProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const [nearbyStudents, setNearbyStudents] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [communities, setCommunities] = useState([])

  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!currentUid) {
        setLoading(false)
        return
      }
      try {
        const profile = await getUserProfile(currentUid)
        if (cancelled) return
        setMyProfile(profile)

        const [nearby, peopleYouMayKnow, trendingCommunities] = await Promise.all([
          getNearbyStudents(profile?.collegeId, currentUid).catch(() => []),
          getPeopleYouMayKnow(currentUid, { course: profile?.course, year: profile?.year }).catch(() => []),
          getTrendingCommunities({ pageSize: 6 }).catch(() => [])
        ])

        if (cancelled) return
        setNearbyStudents(nearby)
        setSuggestions(peopleYouMayKnow)
        setCommunities(trendingCommunities)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUid])

  const goToSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/search')
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-10">
        {/* Header — deliberately not glass-heavy, matches "premium,
            not copying" by using a solid gradient identity band
            instead of a translucent bar like every other page header
            in this project, giving Radar its own visual signature. */}
        <header className="sticky top-0 z-40 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 active:scale-95 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight">Radar</span>
          </div>

          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={goToSearch}
              className="w-full flex items-center gap-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2.5 text-left hover:bg-white/20 transition-all duration-300"
            >
              <Search className="w-4 h-4 text-white/80 flex-shrink-0" />
              <span className="text-sm text-white/70">Search students on campus...</span>
            </button>
          </div>
        </header>

        <main className="px-4 pt-5 space-y-7">
          {/* Nearby Students */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-gray-900">Nearby Students</h2>
              <span className="text-[11px] text-gray-400">Same campus</span>
            </div>
            {loading ? (
              <div className="flex gap-3 overflow-x-auto scroll-hidden pb-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-20 animate-pulse">
                    <div className="w-16 h-16 rounded-full bg-gray-200 mx-auto" />
                    <div className="mt-2 h-2.5 bg-gray-200 rounded w-14 mx-auto" />
                  </div>
                ))}
              </div>
            ) : nearbyStudents.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No one else from your campus has joined yet.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto scroll-hidden pb-1">
                {nearbyStudents.map((student) => (
                  <button
                    key={student.uid}
                    type="button"
                    onClick={() => navigate(`/student/${student.username}`)}
                    className="flex-shrink-0 w-20 text-center animate-in fade-in duration-300"
                  >
                    <div className="relative w-16 h-16 mx-auto">
                      <Avatar
                        initials={getInitials(student.displayName)}
                        colorClass={getAvatarColor(student.uid)}
                        size="lg"
                        src={student.avatar || undefined}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-gray-800 truncate">{student.displayName}</p>
                    <p className="text-[10px] text-gray-400 truncate">{student.course || student.year || ''}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* People You May Know */}
          <section>
            <h2 className="text-[15px] font-bold text-gray-900 mb-3">People You May Know</h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-11 h-11 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                      <div className="h-2 bg-gray-100 rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No suggestions yet — set your course and year in your profile to see people like you.</p>
            ) : (
              <div className="space-y-1">
                {suggestions.map((person) => (
                  <button
                    key={person.uid}
                    type="button"
                    onClick={() => navigate(`/student/${person.username}`)}
                    className="w-full flex items-center gap-3 py-2 hover:bg-gray-50 rounded-xl transition-all duration-200 animate-in fade-in duration-300"
                  >
                    <Avatar
                      initials={getInitials(person.displayName)}
                      colorClass={getAvatarColor(person.uid)}
                      size="md"
                      src={person.avatar || undefined}
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-gray-900 truncate">{person.displayName}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {[person.course, person.year].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Discover */}
          <section>
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h2 className="text-[15px] font-bold text-gray-900">Discover Communities</h2>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : communities.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">No communities yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {communities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            )}
          </section>

          {/* Honest placeholder — no fabricated numbers */}
          <section className="rounded-2xl border border-dashed border-gray-200 p-5 text-center">
            <Users className="w-5 h-5 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-gray-700">Campus Pulse & Live Activity</p>
            <p className="mt-1 text-xs text-gray-400 max-w-[280px] mx-auto leading-relaxed">
              Real-time activity, trending posts, and live event tracking need presence infrastructure
              that isn't built yet — coming in a future update, not shown here with made-up numbers.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}
