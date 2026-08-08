import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

/**
 * Renders a user search result. searchAll() (searchService.js) returns
 * student objects — exact shape unverified since that file has never
 * been shown to me, but this component reads only { uid, displayName,
 * username, course, year } defensively, all optional, matching the
 * lightweight-snapshot pattern already used elsewhere in this project's
 * own search functions (searchUsersForShare, etc). getProfileIdentityImage
 * handles a missing campusAvatarUrl/avatarMode gracefully — if
 * searchAll()'s shape doesn't include them, this still renders correctly
 * using whatever 'avatar' field is present, falling back to initials.
 */
export default function StudentCard({ student }) {
  const navigate = useNavigate()
  const displayName = student.displayName || 'Student'
  const identityImage = getProfileIdentityImage(student)
  const metaParts = [student.course, student.year].filter(Boolean)

  return (
    <button
      type="button"
      onClick={() => navigate(`/student/${student.username || student.uid}`)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all duration-200"
    >
      <Avatar
        initials={getInitials(displayName)}
        colorClass={getAvatarColor(student.uid)}
        size="md"
        src={identityImage || undefined}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
        {student.username && <p className="text-[11px] text-gray-400 truncate">@{student.username}</p>}
        {metaParts.length > 0 && <p className="text-[11px] text-gray-400 truncate">{metaParts.join(' · ')}</p>}
      </div>
    </button>
  )
}
