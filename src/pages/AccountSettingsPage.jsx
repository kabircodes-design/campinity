import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, ShieldCheck, User } from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Account hub — every row links to a real, already-working page
 * (EditProfilePage, SecuritySettingsPage → ChangePasswordPage). Account
 * status is read directly off the real profile (verifiedCampus, college,
 * course, year) — no separate "personal information" duplicate of what
 * Edit Profile already edits, since that would just be two places
 * writing the same fields.
 */
export default function AccountSettingsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()

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
            <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Account</span>
          </div>
        </header>

        <main className="py-2 pb-10">
          <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Profile</p>
          <SettingsItem
            icon={User}
            label="Edit profile"
            description="Name, username, bio, college, course"
            onClick={() => navigate('/profile/edit')}
          />

          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Security</p>
          <SettingsItem
            icon={Lock}
            label="Password & security"
            description="Change your password, sessions"
            onClick={() => navigate('/settings/security')}
          />

          <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Account status</p>
          <div className="mx-4 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
            {profile?.verifiedCampus ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                <ShieldCheck className="w-4 h-4" /> Verified Campus Member
              </p>
            ) : (
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">Not verified</p>
            )}
            {(profile?.college || profile?.course || profile?.year) && (
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {[profile?.college, profile?.course, profile?.year].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
