import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, Compass, Home, MessageCircle, Settings, ShoppingBag, User, Users } from 'lucide-react'
import Avatar from './Avatar.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/search', label: 'Explore', icon: Compass },
  { to: '/communities', label: 'Communities', icon: Users },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings }
]

export default function DesktopSidebar({ unreadNotifications = 0, profile }) {
  const navigate = useNavigate()

  return (
    <nav className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 h-screen sticky top-0 bg-white/40 backdrop-blur-2xl border-r border-white/40 shadow-[4px_0_32px_rgba(91,77,255,0.06)] px-3 py-5">
      <div className="flex items-center gap-2 px-3 mb-6">
        <span className="text-lg font-bold text-blue-600 tracking-tight">Campinity</span>
      </div>
      <div className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-50/90 to-indigo-50/60 text-blue-700 shadow-[inset_0_0_0_1px_rgba(91,77,255,0.12)] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-blue-600'
                  : 'text-gray-600 hover:bg-white/60'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
            {label === 'Notifications' && unreadNotifications > 0 && (
              <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      {profile && (
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer bg-white/40 hover:bg-white/70 active:bg-white/90 active:scale-[0.98] transition-all duration-150 text-left"
        >
          <Avatar
            initials={getInitials(profile.displayName)}
            colorClass={getAvatarColor(profile.uid || profile.displayName)}
            size="sm"
            src={getProfileIdentityImage(profile) || undefined}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{profile.displayName}</p>
              <VerifiedBadge verified={profile.verifiedCampus} size="sm" />
            </div>
            {profile.username && <p className="text-xs text-gray-400 truncate">@{profile.username}</p>}
          </div>
        </button>
      )}
    </nav>
  )
}
