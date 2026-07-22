function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-2/5 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-3 w-3/5 rounded-full bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

/**
 * Fixed-height placeholder rows shown while a search is in flight —
 * same row height/spacing as StudentCard/CollegeResultCard, so results
 * replacing the skeleton never causes a layout jump.
 */
export default function SearchSkeleton({ count = 5 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  )
}