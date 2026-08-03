/** Loading state for the comment list — matches CommentCard.jsx's actual layout shape. */
export default function CommentSkeleton({ rows = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-start gap-2.5 px-4 py-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-2.5 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-2 bg-gray-100 rounded w-1/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
