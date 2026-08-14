import { Bell } from 'lucide-react'

/**
 * Redesigned empty state — matches the same visual language already
 * used across this project's other empty states (icon in a soft
 * tinted circle, bold title, muted subtitle — same pattern as
 * CommunityDetailPage.jsx's "No posts yet" and HomePage's Following
 * empty state), just with a dedicated icon instead of reusing plain
 * text-only versions.
 */
export default function EmptyNotifications() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
        <Bell className="w-6 h-6 text-blue-600" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900">🌱 Your campus is quiet</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[240px] mx-auto leading-relaxed">
        Once something happens, you'll see it here.
      </p>
    </div>
  )
}
