import { useNavigate } from 'react-router-dom'

/**
 * Renders comment text with @mentions highlighted and clickable,
 * opening the mentioned user's profile. Pure text-splitting on a
 * @username pattern — doesn't need the `mentions` uid array to
 * highlight (that's only needed to know WHO to notify at write time),
 * just to render the highlight, since the visual pattern is
 * unambiguous. Reused by CommentCard for both top-level comments and
 * replies, not duplicated per usage.
 */
export default function MentionText({ text, className = '' }) {
  const navigate = useNavigate()
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@') && part.length > 1) {
          const username = part.slice(1)
          return (
            <button
              key={index}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/student/${username}`)
              }}
              className="text-blue-600 font-medium hover:underline"
            >
              {part}
            </button>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
