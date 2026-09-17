import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Users
} from 'lucide-react'
import SettingsItem from '../components/SettingsItem.jsx'
import { useTheme } from '../theme/useTheme.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { logOut } from '../firebase/accountService.js'
import { getAuthErrorMessage, logAuthErrorForDebug } from '../auth/utils/authErrorMessages.js'
import { useAuth } from '../context/AuthContext.jsx'

const MODE_LABELS = { light: 'Light', dark: 'Dark', system: 'System default' }

/**
 * Settings 2.0 — the previous version dumped Appearance's full mode +
 * theme-pack picker directly onto this page (the explicit "theme
 * shouldn't be a giant control at the top" complaint), plus every
 * individual toggle lived here too. Now this is purely an INDEX: one
 * profile row, then real grouped categories, each a single row linking
 * to its own dedicated page — none of which are fabricated, every
 * route below already exists and does real work (see each page's own
 * file). Appearance itself is completely untouched (AppearanceSettings.jsx,
 * ThemeProvider) — only relocated to /settings/appearance.
 */
export default function SettingsPage() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { profile } = useAuth()
  const { mode } = useTheme()

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
              <button
                type="button"
                onClick={() => navigate('/profile/edit')}
                className="flex items-center gap-3 mt-3 mx-4 w-[calc(100%-2rem)] rounded-2xl border border-gray-100 dark:border-white/10 p-4 text-left hover:border-gray-200 dark:hover:border-white/20 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 font-bold text-lg overflow-hidden">
                  {getProfileIdentityImage(profile) ? (
                    <img src={getProfileIdentityImage(profile)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profile.displayName || '?').slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate">{profile.displayName || 'Student'}</p>
                    {profile.verifiedCampus && <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">@{profile.username}</p>
                  <p className="mt-1 text-[11.5px] font-semibold text-blue-600 dark:text-blue-400">Edit profile</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              </button>
            )}

            <section className="mt-4 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Account</p>
              <SettingsItem icon={User} label="Account" description="Profile, password, account status" onClick={() => navigate('/settings/account')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Privacy</p>
              <SettingsItem icon={ShieldCheck} label="Privacy" description="Who can message, mention or find you" onClick={() => navigate('/settings/privacy')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Notifications</p>
              <SettingsItem icon={Bell} label="Notifications" description="Choose what you get notified about" onClick={() => navigate('/settings/notifications')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Appearance</p>
              <SettingsItem
                icon={Palette}
                label="Theme"
                description={MODE_LABELS[mode] || 'System default'}
                onClick={() => navigate('/settings/appearance')}
              />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Content & Activity</p>
              <SettingsItem icon={Sparkles} label="Content & Activity" description="Saved posts, preferences, muted content" onClick={() => navigate('/settings/activity')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Messages</p>
              <SettingsItem icon={Bell} label="Messages" description="Message requests, who can message you" onClick={() => navigate('/settings/messages')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Communities</p>
              <SettingsItem icon={Users} label="Communities" description="Community notifications and preferences" onClick={() => navigate('/settings/communities')} />
            </section>

            <section className="mt-2 border-t border-gray-100 dark:border-white/10">
              <p className="px-4 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Security</p>
              <SettingsItem icon={Lock} label="Security" description="Password, sessions, two-factor authentication" onClick={() => navigate('/settings/security')} />
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
