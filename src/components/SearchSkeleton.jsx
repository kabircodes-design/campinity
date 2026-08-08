/** Loading state for search results — matches CommentSkeleton.jsx's established pulse pattern, sized for StudentCard/CollegeResultCard's row layout. */
export default function SearchSkeleton({ rows = 5 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-2.5 bg-gray-200 rounded w-1/3" />
            <div className="h-2 bg-gray-100 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
