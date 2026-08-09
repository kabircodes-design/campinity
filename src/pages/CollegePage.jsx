import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, GraduationCap, MapPin } from 'lucide-react'
import CommunityCard from '../components/CommunityCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getCollegeById } from '../data/dummyColleges.js'
import { getCollegeCommunities } from '../firebase/communityService.js'

/**
 * Communities for this college reuse getCollegeCommunities() directly
 * — an existing, already-working query (confirmed by reading it
 * before writing this page) — rather than inventing a new one.
 * CommunityCard.jsx (also existing, untouched) renders the results,
 * matching "integrate only if the data/query already exists."
 */
export default function CollegePage() {
  const { collegeId } = useParams()
  const navigate = useNavigate()

  const [college, setCollege] = useState(null)
  const [collegeLoading, setCollegeLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setCollegeLoading(true)
    getCollegeById(collegeId)
      .then((result) => {
        if (!cancelled) setCollege(result)
      })
      .catch(() => {
        if (!cancelled) setCollege(null)
      })
      .finally(() => {
        if (!cancelled) setCollegeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collegeId])

  const [communities, setCommunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (collegeLoading || !college) {
      if (!collegeLoading) setLoading(false)
      return
    }
    let cancelled = false
    getCollegeCommunities(collegeId)
      .then((results) => {
        if (!cancelled) setCommunities(results)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collegeId, college, collegeLoading])

  if (collegeLoading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="md" tone="dark" />
      </div>
    )
  }

  if (!college) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">College not found</p>
            <p className="mt-1 text-sm text-gray-400">This college may not exist yet.</p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 truncate">{college.name}</span>
          </div>
        </header>

        <div className="px-4 py-6 flex items-start gap-3 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900">{college.name}</p>
            {(college.city || college.state) && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-400">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {[college.city, college.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Communities</p>
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader size="md" tone="dark" />
            </div>
          ) : communities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No communities from this college yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {communities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
