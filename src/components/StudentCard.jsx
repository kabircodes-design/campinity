import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'

export default function StudentCard({ student }) {
  const navigate = useNavigate()
  const [following, setFollowing] = useState(false)

  const goToProfile = () => navigate(`/student/${student.username}`)

  const toggleFollow = (event) => {
    event.stopPropagation()
    setFollowing((prev) => !prev)
  }

  return (
    <button
      type="button"
      onClick={goToProfile}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <Avatar initials={student.initials} colorClass={student.colorClass} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {student.department} · {student.year} · {student.college}
        </p>
      </div>

      <span
        role="button"
        tabIndex={0}
        onClick={toggleFollow}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') toggleFollow(event)
        }}
        className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
          following ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white'
        }`}
      >
        {following ? 'Following' : 'Follow'}
      </span>
    </button>
  )
}