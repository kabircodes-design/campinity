import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'

/**
 * Password & security lives here for real (→ ChangePasswordPage, a
 * genuine Firebase Auth reauth-then-updatePassword flow). Login
 * activity / active sessions / 2FA have no backing implementation
 * anywhere in this app (Firebase Auth's session model doesn't expose a
 * per-device session list to a client SDK the way a custom backend
 * would, and no 2FA enrollment flow exists) — shown honestly as
 * disabled "Coming soon" rows rather than fake toggles that don't
 * persist anything.
 */
export default function SecuritySettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:my-4 lg:rounded-2xl lg:border lg:border-gray-100 dark:lg:border-white/10 lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Security</span>
          </div>
        </header>

        <main className="py-2 pb-10">
          <SettingsItem
            icon={Lock}
            label="Password & security"
            description="Change your password"
            onClick={() => navigate('/settings/change-password')}
          />
          <SettingsItem
            icon={Clock}
            label="Login activity"
            description="Coming soon"
            rightElement={<span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">Coming soon</span>}
          />
          <SettingsItem
            icon={Smartphone}
            label="Active sessions"
            description="Coming soon"
            rightElement={<span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">Coming soon</span>}
          />
          <SettingsItem
            icon={ShieldCheck}
            label="Two-factor authentication"
            description="Coming soon"
            rightElement={<span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">Coming soon</span>}
          />
        </main>
      </div>
    </div>
  )
}
