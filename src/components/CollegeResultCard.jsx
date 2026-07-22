import { useNavigate } from 'react-router-dom'
import { BadgeCheck, GraduationCap, MapPin } from 'lucide-react'

export default function CollegeResultCard({ college }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/college/${college.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      {college.logo ? (
        <img
          src={college.logo}
          alt=""
          className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border border-gray-100"
        />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="w-5 h-5 text-blue-600" strokeWidth={1.8} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{college.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 truncate">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {college.city}, {college.state}
        </p>
      </div>

      {college.verified && <BadgeCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />}
    </button>
  )
}