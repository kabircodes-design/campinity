import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, HelpCircle, Info, LogOut, Moon, Shield, UserX } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import SettingsItem from '../components/SettingsItem.jsx'
import Switch from '../components/Switch.jsx'
import { useDarkMode } from '../hooks/useDarkMode.js'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [darkMode, setDarkMode] = useDarkMode()

  const handleLogout = () => {
    // TODO(firebase): auth.signOut() then navigate('/login') once Firebase is wired up.
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
            <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Preferences</p>
            <SettingsItem icon={Bell} label="Notifications" onClick={() => navigate('/settings/notifications')} />
            <SettingsItem icon={Shield} label="Privacy" onClick={() => navigate('/settings/privacy')} />
            <SettingsItem icon={UserX} label="Blocked Users" onClick={() => navigate('/settings/blocked-users')} />
          </section>

          <section className="mt-2 border-t border-gray-100">
            <SettingsItem icon={HelpCircle} label="Help & Support" onClick={() => navigate('/settings/help')} />
            <SettingsItem icon={Info} label="About Campinity" onClick={() => navigate('/settings/about')} />
          </section>

          <section className="mt-2 border-t border-gray-100">
            <SettingsItem icon={LogOut} label="Log out" tone="danger" onClick={handleLogout} />
          </section>

          <p className="mt-6 text-center text-xs text-gray-300">Campinity — Version 1.0.0 (MVP)</p>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}