import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  HelpCircle,
  Info,
  Lock,
  LogOut,
  MessageCircle,
  Palette,
  Radar,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserX,
  Users
} from 'lucide-react'
import { useTheme } from '../theme/useTheme.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { logOut } from '../firebase/accountService.js'
import { getAuthErrorMessage, logAuthErrorForDebug } from '../auth/utils/authErrorMessages.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useBackToClose } from '../navigation/overlayBackStack.js'

const MODE_LABELS = { light: 'Light', dark: 'Dark', system: 'System' }
const MESSAGE_PRIVACY_LABELS = { everyone: 'Everyone', following: 'People you follow' }

function Row({ icon: Icon, tint = 'bg-blue-50 text-blue-600', label, description, value, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[56px] flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
    >
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50 text-red-600' : tint}`}>
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.9} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-medium leading-tight ${danger ? 'text-red-600' : 'text-gray-900'}`}>{label}</span>
        {description && <span className="block mt-0.5 text-xs text-gray-500 leading-snug">{description}</span>}
      </span>
      {value && <span className="flex-shrink-0 max-w-[40%] truncate text-[13px] text-gray-500">{value}</span>}
      {!danger && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
    </button>
  )
}

function Group({ title, children }) {
  return (
    <section className="mt-5">
      {title && <h2 className="px-5 pb-2 text-[13px] font-semibold text-gray-500">{title}</h2>}
      <div className="mx-4 rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">{children}</div>
    </section>
  )
}

/**
 * Settings index. Every row links to an existing, working settings page
 * (or Radar) and shows its real current value where one exists — theme
 * (ThemeProvider), who can message you (users.messagePrivacy) and Radar
 * visibility (users.radarVisible). No placeholder settings are added.
 */
export default function SettingsPage() {
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  useBackToClose(confirmLogout, () => !isLoggingOut && setConfirmLogout(false))
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
      setConfirmLogout(false)
    }
  }

  const avatar = profile ? getProfileIdentityImage(profile) : null
  const messagePrivacy = MESSAGE_PRIVACY_LABELS[profile?.messagePrivacy] || 'Everyone'
  const radarValue = profile ? (profile.radarVisible === false ? 'Hidden' : 'Visible') : null

  return (
    <div className="min-h-screen lg:min-h-0 lg:h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[560px] lg:max-w-[640px] pb-24 lg:pb-10">
        <header className="px-4 pt-4 flex items-center gap-1">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate('/profile')}
            className="lg:hidden w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        </header>

        {profile && (
          <button
            type="button"
            onClick={() => navigate('/profile/edit')}
            className="mt-4 mx-4 w-[calc(100%-2rem)] flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left hover:border-gray-200 active:scale-[0.99] transition-all duration-200"
          >
            <span className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-xl overflow-hidden">
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : (profile.displayName || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="text-base font-bold text-gray-900 truncate">{profile.displayName || 'Student'}</span>
                {profile.verifiedCampus && <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" aria-label="Verified" />}
              </span>
              <span className="block text-[13px] text-gray-500 truncate">@{profile.username}</span>
              <span className="block mt-1 text-xs font-semibold text-blue-600">Edit profile</span>
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </button>
        )}

        <Group title="Account">
          <Row icon={User} label="Account" description="Profile, username, email, password" onClick={() => navigate('/settings/account')} />
          <Row icon={Lock} tint="bg-gray-100 text-gray-700" label="Security" description="Password, email verification, sign-in" onClick={() => navigate('/settings/security')} />
        </Group>

        <Group title="Privacy & safety">
          <Row icon={ShieldCheck} tint="bg-emerald-50 text-emerald-600" label="Privacy" description="Who can message you, activity status" value={profile ? messagePrivacy : null} onClick={() => navigate('/settings/privacy')} />
          <Row icon={UserX} tint="bg-rose-50 text-rose-600" label="Blocked users" onClick={() => navigate('/settings/blocked-users')} />
          <Row icon={Users} tint="bg-emerald-50 text-emerald-600" label="Close friends" onClick={() => navigate('/settings/close-friends')} />
        </Group>

        <Group title="Location & Radar">
          <Row icon={Radar} tint="bg-cyan-50 text-cyan-600" label="Radar visibility" description="Whether campus students can discover you" value={radarValue} onClick={() => navigate('/radar')} />
        </Group>

        <Group title="Preferences">
          <Row icon={Bell} tint="bg-amber-50 text-amber-600" label="Notifications" description="Choose what you get notified about" onClick={() => navigate('/settings/notifications')} />
          <Row icon={MessageCircle} label="Messages" description="Message requests and who can message you" onClick={() => navigate('/settings/messages')} />
          <Row icon={Palette} tint="bg-purple-50 text-purple-600" label="Appearance" value={MODE_LABELS[mode] || 'System'} onClick={() => navigate('/settings/appearance')} />
          <Row icon={Sparkles} tint="bg-pink-50 text-pink-600" label="Content & activity" description="Saved posts and your activity" onClick={() => navigate('/settings/activity')} />
          <Row icon={Users} tint="bg-indigo-50 text-indigo-600" label="Communities" description="Community preferences" onClick={() => navigate('/settings/communities')} />
        </Group>

        <Group title="Support">
          <Row icon={HelpCircle} tint="bg-gray-100 text-gray-600" label="Help & support" onClick={() => navigate('/settings/help')} />
          <Row icon={Info} tint="bg-gray-100 text-gray-600" label="About Campinity" onClick={() => navigate('/settings/about')} />
        </Group>

        <Group>
          <Row icon={LogOut} label={isLoggingOut ? 'Logging out…' : 'Log out'} danger onClick={() => setConfirmLogout(true)} />
          <Row icon={Trash2} label="Delete account" danger onClick={() => navigate('/settings/delete-account')} />
        </Group>

        {logoutError && (
          <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
            {logoutError}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">Campinity · Version 1.0.0</p>
      </div>

      {confirmLogout &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <button type="button" aria-label="Cancel" onClick={() => !isLoggingOut && setConfirmLogout(false)} className="absolute inset-0 bg-black/40" />
            <div className="relative w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl">
              <p id="logout-title" className="text-base font-bold text-gray-900">Log out of Campinity?</p>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">You can sign back in any time with your email and password.</p>
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLogout(false)}
                  disabled={isLoggingOut}
                  className="flex-1 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoggingOut ? 'Logging out…' : 'Log out'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
