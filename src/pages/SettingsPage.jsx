import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Bookmark, HelpCircle, Info, Lock, LogOut, Shield, ShieldCheck, Trash2, User, UserX, ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import SettingsItem from '../components/SettingsItem.jsx'
import AppearanceSettings from '../components/AppearanceSettings.jsx'
import { logOut } from '../firebase/accountService.js'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getUserProfile(uid).then(setProfile).catch(() => {})
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await logOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setLogoutError(err?.message || 'Could not log out. Please try again.')
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden theme-bg-background">
      <DesktopSidebar profile={profile} />
      <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto overflow-x-hidden theme-bg-background">
        <div className="mx-auto max-w-[480px] lg:max-w-[640px] theme-bg-surface min-h-screen lg:min-h-0 lg:shadow-sm">
          <header className="sticky top-0 z-40 theme-bg-surface backdrop-blur-md border-b theme-border">
            <div className="h-14 flex items-center gap-2 px-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate('/profile')}
                className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center theme-text-secondary hover:bg-black/5 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-bold tracking-tight theme-text-primary">Settings</span>
            </div>
          </header>

        <main className="pb-24">
          {profile && (
            <section className="mt-3 mx-4 rounded-2xl border theme-border p-4">
              <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide mb-2">Campus identity</p>
              <p className="text-sm font-bold theme-text-primary">{profile.displayName || 'Student'}</p>
              <p className="text-xs theme-text-secondary">@{profile.username}</p>
              <div className="mt-2 flex items-center gap-1.5">
                {profile.verifiedCampus ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                    <ShieldCheck className="w-3 h-3" /> Verified Campus Member
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-gray-400">Not verified</span>
                )}
              </div>
              {(profile.course || profile.year) && (
                <p className="mt-1.5 text-xs theme-text-secondary">
                  {[profile.course, profile.year].filter(Boolean).join(' · ')}
                </p>
              )}
            </section>
          )}

          <section className="mt-2">
            <AppearanceSettings />
          </section>

          <section className="mt-2 border-t theme-border">
            <p className="px-4 py-2 text-xs font-semibold theme-text-secondary uppercase tracking-wide">Account</p>
            <SettingsItem icon={Bookmark} label="Saved" onClick={() => navigate('/saved')} />
            <SettingsItem icon={User} label="Edit Profile" onClick={() => navigate('/profile/edit')} />
            <SettingsItem icon={Lock} label="Change Password" onClick={() => navigate('/settings/change-password')} />
          </section>

          <section className="mt-2 border-t theme-border">
            <p className="px-4 py-2 text-xs font-semibold theme-text-secondary uppercase tracking-wide">Preferences</p>
            <SettingsItem icon={Bell} label="Notifications" onClick={() => navigate('/settings/notifications')} />
            <SettingsItem icon={Shield} label="Privacy" onClick={() => navigate('/settings/privacy')} />
            <SettingsItem icon={UserX} label="Blocked Users" onClick={() => navigate('/settings/blocked-users')} />
          </section>

          <section className="mt-2 border-t theme-border">
            <p className="px-4 py-2 text-xs font-semibold theme-text-secondary uppercase tracking-wide">Support</p>
            <SettingsItem icon={HelpCircle} label="Help & Support" onClick={() => navigate('/settings/help')} />
            <SettingsItem icon={Info} label="About Campinity" onClick={() => navigate('/settings/about')} />
          </section>

          <section className="mt-2 border-t theme-border">
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
            <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {logoutError}
            </p>
          )}

          <p className="mt-6 text-center text-xs theme-text-secondary">Campinity — Version 1.0.0 (MVP)</p>
        </main>
      </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
