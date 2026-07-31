import { useNavigate } from 'react-router-dom'
import { Lock, Users } from 'lucide-react'

const typeLabels = {
  official_club: 'Official Club',
  study_group: 'Study Group',
  hostel: 'Hostel',
  branch: 'Branch',
  batch: 'Batch',
  society: 'Society',
  event: 'Event',
  custom: 'Community'
}

/**
 * Reusable community card — Discover-style layout (cover strip, logo
 * overlapping it, name/handle/type/privacy/member count, short
 * description). Used by HomePage's Clubs tab now; written generically
 * enough that a future Discover/Search page can reuse it without
 * duplicating this markup.
 */
export default function CommunityCard({ community }) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/community/${community.id}`)}
      className="w-full text-left rounded-2xl border border-gray-100 bg-white overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all duration-300"
    >
      <div className="h-20 bg-gradient-to-br from-blue-600 to-indigo-700 relative">
        {community.coverImage && (
          <img src={community.coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      <div className="px-3.5 pb-3.5">
        <div className="-mt-6 flex items-end justify-between">
          <div className="w-12 h-12 rounded-xl bg-white border-4 border-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
            {community.icon ? (
              <img src={community.icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5 text-blue-600" strokeWidth={1.7} />
            )}
          </div>
          <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5">
            {community.privacy === 'private' && <Lock className="w-2.5 h-2.5" />}
            {community.privacy === 'private' ? 'Private' : 'Public'}
          </span>
        </div>

        <p className="mt-2 text-sm font-bold text-gray-900 truncate">{community.name}</p>
        <p className="text-xs text-gray-400 truncate">@{community.handle}</p>

        {community.description && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed line-clamp-2">{community.description}</p>
        )}

        <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 font-semibold px-2 py-0.5">
            {typeLabels[community.type] || 'Community'}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {community.membersCount}
          </span>
        </div>
      </div>
    </button>
  )
}
