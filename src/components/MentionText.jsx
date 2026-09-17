import { useNavigate } from 'react-router-dom'

/**
 * Renders text with @mentions AND #hashtags highlighted and clickable
 * — one combined split/pass, not two separate parsers layered on each
 * other (which would double-process the same string and risk one
 * regex mangling matches the other already replaced). Mentions open
 * the mentioned user's profile; hashtags open the dedicated
 * /hashtag/:tag page (HashtagPage.jsx) — reuses the same
 * searchPostsByHashtag query the old /search?tag= deep link used, just
 * a real dedicated surface instead of routing through Search. Doesn't
 * need the `mentions` uid array to
 * highlight (that's only needed to know WHO to notify at write time),
 * just to render the highlight, since both visual patterns are
 * unambiguous. Reused by CommentCard, PostCard, and PostDetailPage —
 * not duplicated per usage.
 */
export default function MentionText({ text, className = '' }) {
  const navigate = useNavigate()
  const parts = text.split(/(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g)

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
        if (part.startsWith('#') && part.length > 1) {
          const tag = part.slice(1)
          return (
            <button
              key={index}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/hashtag/${encodeURIComponent(tag.toLowerCase())}`)
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
