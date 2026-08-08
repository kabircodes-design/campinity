import { useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

/**
 * Renders a college search result. Exact object shape from searchAll()
 * (searchService.js) is unverified — dummyColleges.js, which would
 * confirm the canonical college shape, is also absent from this project
 * (a separate, unrelated finding — noted, not fixed here). Built
 * defensively: only { id, name, location/city } are read, all with
 * fallbacks, so this renders safely regardless of which optional fields
 * are actually present.
 */
export default function CollegeResultCard({ college }) {
  const navigate = useNavigate()
  const name = college.name || 'College'
  const location = college.location || college.city || ''

  return (
    <button
      type="button"
      onClick={() => navigate(`/college/${college.id}`)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all duration-200"
    >
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        <GraduationCap className="w-4.5 h-4.5 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        {location && <p className="text-[11px] text-gray-400 truncate">{location}</p>}
      </div>
    </button>
  )
}
