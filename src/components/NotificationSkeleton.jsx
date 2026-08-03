/**
 * New — replaces the plain spinner NotificationsPage.jsx used for its
 * loading state. Row shape matches NotificationCard.jsx's actual
 * layout (avatar + two text lines + trailing space) so the skeleton
 * doesn't visually jump when real content replaces it. Pure CSS
 * animate-pulse (Tailwind's built-in), no extra animation library.
 */
export default function NotificationSkeleton({ rows = 6 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 px-4 py-3.5 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0 pt-1 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
