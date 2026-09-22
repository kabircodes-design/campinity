import { Bell, X } from 'lucide-react'

/** Same shape as CampusVerificationBanner.jsx, rendered right below it on Home. */
export default function NotificationPermissionBanner({ onAllow, onDismiss }) {
  return (
    <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-400/20 px-3.5 py-3">
      <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-blue-900 dark:text-blue-100">Stay in the loop</p>
        <p className="text-[11.5px] text-blue-700 dark:text-blue-300">Get notified about messages, calls and campus activity.</p>
      </div>
      <button
        type="button"
        onClick={onAllow}
        className="flex-shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-semibold px-3 py-1.5 hover:bg-blue-700 transition-all duration-300"
      >
        Allow
      </button>
      <button type="button" onClick={onDismiss} aria-label="Not now" className="flex-shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors duration-200">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
