import { Bell } from 'lucide-react'

/**
 * Redesign pass — removed the bg-white/35 backdrop-blur-md glass
 * treatment (same root cause as ProfilePage.jsx/SearchPage.jsx had
 * before their own redesigns) in favor of the plain white/gray-100
 * border+shadow language HomePage.jsx and DiscoverCommunitiesPage.jsx
 * already use. Layout (icon in a soft tinted circle, bold title, muted
 * subtitle) is unchanged — that part already matched the rest of the
 * app's empty-state pattern.
 */
export default function EmptyNotifications() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center mx-auto">
        <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" strokeWidth={1.7} />
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-50">You're all caught up!</p>
      <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-[240px] mx-auto leading-relaxed">
        Nothing new here. We'll let you know when something happens.
      </p>
    </div>
  )
}
