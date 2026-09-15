import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bookmark, HelpCircle, Info, Lock, LogOut, Shield, ShieldCheck, Trash2, User, UserX, ArrowLeft } from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'
import AppearanceSettings from '../components/AppearanceSettings.jsx'
import ContentPreferences from '../onboarding/ContentPreferences.jsx'
import { logOut } from '../firebase/accountService.js'
import { getAuthErrorMessage, logAuthErrorForDebug } from '../auth/utils/authErrorMessages.js'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Rebuilt on plain Tailwind (bg-white/bg-gray-50/border-gray-100/
 * blue-600), matching HomePage.jsx and DiscoverCommunitiesPage.jsx
 * exactly — confirmed by reading both directly, neither uses a single
 * theme-prefixed token class. The previous version's theme-bg-surface,
 * theme-text-primary, and backdrop-blur-md layer made Settings the
 * one page in the app whose surface color and blur depend on whichever theme pack
 * happens to be active, which is precisely why it read as visually
 * inconsistent with the rest of Campinity — not because any one class
 * was "too glassy," but because it was the only page still on a
 * different design system. AppearanceSettings.jsx itself (the actual
 * theme-pack picker) is untouched — a real, working preference UI,
 * not something this pass removes.
 *
 * Every item below now routes to a REAL page — Notifications, Privacy,
 * and Blocked Users were <ComingSoon> placeholders before this pass;
 * see NotificationSettingsPage.jsx / PrivacySettingsPage.jsx /
 * BlockedUsersPage.jsx and App.jsx's updated routes.
 */
export default function SettingsPage() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { profile } = useAuth()

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await logOut()
      navigate('/login', { replace: true })
    } catch (err) {
      logAuthErrorForDebug('SettingsPage.handleLogout', err)
      setLogoutError(getAuthErrorMessage(err))
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
        <div className="mx-auto max-w-[480px] lg:max-w-[640px] bg-white dark:bg-[#11131a] min-h-full lg:min-h-0 lg:my-6 lg:rounded-2xl lg:shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:lg:shadow-none lg:border lg:border-gray-100 dark:lg:border-white/10">
          <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-md border-b border-gray-100 dark:border-white/10 lg:rounded-t-2xl">
            <div className="h-14 flex items-center gap-2 px-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate('/profile')}
                className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-50">Settings</span>
            </div>
          </header>

          <main className="pb-24 lg:pb-8">
            {profile && (
              <section className="mt-3 mx-4 rounded-2xl border border-gray-100 dark:border-white/10 p-4">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Campus identity</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-50">{profile.displayName || 'Student'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">@{profile.username}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  {profile.verifiedCampus ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      <ShieldCheck className="w-3 h-3" /> Verified Campus Member
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">Not verified</span>
                  )}
                </div>
                {(profile.course || profile.year) && (
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {[profile.course, profile.year].filter(Boolean).join(' · ')}
                  </p>
                )}
              </section>
            )}

            <section className="mt-3 mx-4">
              <ContentPreferences />
            </section>

            <section className="mt-2">
              <AppearanceSettings />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Account</p>
              <SettingsItem icon={Bookmark} label="Saved" onClick={() => navigate('/saved')} />
              <SettingsItem icon={User} label="Edit Profile" description="Update your personal information" onClick={() => navigate('/profile/edit')} />
              <SettingsItem icon={Lock} label="Change Password" description="Update your account password" onClick={() => navigate('/settings/change-password')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Preferences</p>
              <SettingsItem icon={Bell} label="Notifications" description="Choose what you get notified about" onClick={() => navigate('/settings/notifications')} />
              <SettingsItem icon={Shield} label="Privacy" description="Who can message you, blocked accounts" onClick={() => navigate('/settings/privacy')} />
              <SettingsItem icon={UserX} label="Blocked Users" description="Manage accounts you've blocked" onClick={() => navigate('/settings/blocked-users')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Support</p>
              <SettingsItem icon={HelpCircle} label="Help & Support" onClick={() => navigate('/settings/help')} />
              <SettingsItem icon={Info} label="About Campinity" onClick={() => navigate('/settings/about')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <SettingsItem
                icon={LogOut}
                label={isLoggingOut ? 'Logging out…' : 'Log out'}
                tone="danger"
                onClick={handleLogout}
              />
              <SettingsItem
                icon={Trash2}
                label="Delete Account"
                tone="danger"
                onClick={() => navigate('/settings/delete-account')}
              />
            </section>

            {logoutError && (
              <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 text-[13px] px-4 py-3">
                {logoutError}
              </p>
            )}

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">Campinity — Version 1.0.0 (MVP)</p>
          </main>
        </div>
    </div>
  )
}
