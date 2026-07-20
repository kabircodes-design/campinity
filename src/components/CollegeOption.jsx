import { BadgeCheck, MapPin } from 'lucide-react'

export default function CollegeOption({ college, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(college)}
      className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-gray-50 transition-all duration-300"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{college.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 truncate">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {college.city}, {college.state} · {college.type}
        </p>
      </div>
      {college.verified && <BadgeCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />}
    </button>
  )
}