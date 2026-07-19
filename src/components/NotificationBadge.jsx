export default function NotificationBadge({ count, className = '' }) {
    if (!count || count <= 0) return null
    const display = count > 9 ? '9+' : count
  
    return (
      <span
        className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold ${className}`}
      >
        {display}
      </span>
    )
  }