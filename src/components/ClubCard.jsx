import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'

export default function ClubCard({ club }) {
  const navigate = useNavigate()
  const [joined, setJoined] = useState(false)

  const goToClub = () => navigate(`/club/${club.id}`)

  const toggleJoin = (event) => {
    event.stopPropagation()
    setJoined((prev) => !prev)
  }

  return (
    <button
      type="button"
      onClick={goToClub}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all duration-300 text-left"
    >
      <Avatar initials={club.initials} colorClass={club.colorClass} size="md" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{club.name}</p>
        <p className="text-xs text-gray-400 truncate">
          {club.category} · {club.members} members
        </p>
      </div>

      <span
        role="button"
        tabIndex={0}
        onClick={toggleJoin}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') toggleJoin(event)
        }}
        className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
          joined ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white'
        }`}
      >
        {joined ? 'Joined' : 'Join'}
      </span>
    </button>
  )
}