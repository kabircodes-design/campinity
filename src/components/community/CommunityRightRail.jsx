import { Calendar, Lock, Tag, Users } from 'lucide-react'

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
 * Desktop-only contextual panel (xl+). Every field here comes straight
 * off the already-loaded community doc — no extra reads, and nothing
 * fabricated (no "N people online" — this schema has no presence data,
 * so it's simply not shown, per the "never fake it" instruction).
 */
export default function CommunityRightRail({ community, onViewMembers, onViewAbout }) {
  const createdDate = community.createdAt?.toDate
    ? community.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">About</p>
        {community.description && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{community.description}</p>
        )}
        <div className="mt-3 space-y-2 text-[13px] text-gray-500">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {community.membersCount} {community.membersCount === 1 ? 'member' : 'members'}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold px-2 py-0.5">
              {typeLabels[community.type] || 'Community'}
            </span>
            {community.privacy === 'private' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <Lock className="w-3 h-3" /> Private
              </span>
            )}
          </div>
          {createdDate && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              Created {createdDate}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onViewAbout}
          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
        >
          View full About →
        </button>
      </div>

      {community.tags?.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {community.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium px-2 py-1">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onViewMembers}
        className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200"
      >
        <p className="text-sm font-semibold text-gray-900">Member directory</p>
        <p className="mt-0.5 text-xs text-gray-400">Search and browse everyone here →</p>
      </button>
    </div>
  )
}
