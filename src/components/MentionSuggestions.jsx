import Avatar from './Avatar.jsx'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

/** Presentational dropdown for useMentionAutocomplete — same visual pattern CommentComposer.jsx's inline version already uses. */
export default function MentionSuggestions({ results, activeIndex, onSelect, className = '' }) {
  if (results.length === 0) return null

  return (
    <div className={`rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-40 max-h-48 overflow-y-auto [animation:modalIn_150ms_cubic-bezier(0.16,1,0.3,1)] ${className}`}>
      {results.map((user, index) => (
        <button
          key={user.uid}
          type="button"
          onClick={() => onSelect(user)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 ${
            index === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
          }`}
        >
          <Avatar
            initials={(user.displayName || '?').slice(0, 1).toUpperCase()}
            colorClass="from-gray-300 to-gray-400"
            size="sm"
            src={getProfileIdentityImage(user)}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user.displayName}</p>
            <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
