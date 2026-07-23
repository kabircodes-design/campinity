import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  Moon,
  Shield,
  Trash2,
  User,
  UserX
} from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import SettingsItem from '../components/SettingsItem.jsx'
import Switch from '../components/Switch.jsx'
import { useDarkMode } from '../hooks/useDarkMode.js'
import { logOut } from '../firebase/accountService.js'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useDarkMode()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

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
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Settings</span>
          </div>
        </header>

        <main className="pb-24">
          <section className="mt-2">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Appearance</p>
            <SettingsItem
              icon={Moon}
              label="Dark Mode"
              rightElement={<Switch checked={darkMode} onChange={setDarkMode} label="Dark mode" />}
            />
          </section>

          <section className="mt-2 border-t border-gray-100">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Account</p>
            <SettingsItem icon={User} label="Edit Profile" onClick={() => navigate('/profile/edit')} />
            <SettingsItem icon={Lock} label="Change Password" onClick={() => navigate('/settings/change-password')} />
          </section>

          <section className="mt-2 border-t border-gray-100">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Preferences</p>
            <SettingsItem icon={Bell} label="Notifications" onClick={() => navigate('/settings/notifications')} />
            <SettingsItem icon={Shield} label="Privacy" onClick={() => navigate('/settings/privacy')} />
            <SettingsItem icon={UserX} label="Blocked Users" onClick={() => navigate('/settings/blocked-users')} />
          </section>

          <section className="mt-2 border-t border-gray-100">
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Support</p>
            <SettingsItem icon={HelpCircle} label="Help & Support" onClick={() => navigate('/settings/help')} />
            <SettingsItem icon={Info} label="About Campinity" onClick={() => navigate('/settings/about')} />
          </section>

          <section className="mt-2 border-t border-gray-100">
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

          <p className="mt-6 text-center text-xs text-gray-300">Campinity — Version 1.0.0 (MVP)</p>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}