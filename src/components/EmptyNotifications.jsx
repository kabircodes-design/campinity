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
    <div className="mx-4 mt-4 px-6 py-16 text-center rounded-2xl bg-white/35 backdrop-blur-md border border-white/50 shadow-[inset_1px_1px_0_rgba(255,255,255,0.5),0_4px_16px_rgba(91,77,255,0.06)]">
      <div className="w-14 h-14 rounded-2xl bg-white/50 backdrop-blur-sm border border-white/40 flex items-center justify-center mx-auto">
        <Bell className="w-6 h-6 text-blue-600" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900">🌱 Your campus is quiet</p>
      <p className="mt-1 text-sm text-gray-400 max-w-[240px] mx-auto leading-relaxed">
        Once something happens, you'll see it here.
      </p>
    </div>
  )
}
