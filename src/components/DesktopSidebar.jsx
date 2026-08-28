import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, Compass, Home, MessageCircle, PackageSearch, Settings, ShoppingBag, User, Users } from 'lucide-react'
import Avatar from './Avatar.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'

const NAV_ITEMS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/search', label: 'Explore', icon: Compass },
  { to: '/communities', label: 'Communities', icon: Users },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/lost-found', label: 'Lost & Found', icon: PackageSearch },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings }
]

/**
 * Restored to the original white/blue Campinity theme, per explicit
 * instruction to remove the dark-only redesign from two turns ago.
 * The Lost & Found nav item (added in a separate, later task) is
 * preserved — only the dark-theme colors are reverted, not the
 * feature additions layered on top of that redesign. Glass surface
 * matches this project's established light-mode glass language
 * (bg-white/40 backdrop-blur-2xl) rather than the dark rgba() values
 * used two turns ago. "Campus Points" remains omitted — still no
 * confirmed field for it anywhere in profileService.js's real shape.
 */
export default function DesktopSidebar({ unreadNotifications = 0, profile }) {
  const navigate = useNavigate()

  return (
    <div className="hidden lg:block w-64 flex-shrink-0 h-screen sticky top-0 p-4">
      <nav className="flex flex-col h-[calc(100vh-2rem)] bg-white/40 backdrop-blur-2xl rounded-3xl border border-white/50 shadow-[0_8px_32px_rgba(91,77,255,0.10),inset_1px_1px_0_rgba(255,255,255,0.5)] px-3 py-5">
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Campinity — go to Home"
          className="flex items-center gap-2 px-3 mb-7"
        >
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #5b4dff, #7b61ff)',
              boxShadow: '0 4px 14px rgba(91,77,255,0.35)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <line x1="6" y1="6" x2="14" y2="6" stroke="#ffffff" strokeWidth="1.6" />
              <line x1="6" y1="6" x2="10" y2="15" stroke="#ffffff" strokeWidth="1.6" />
              <line x1="14" y1="6" x2="10" y2="15" stroke="#ffffff" strokeWidth="1.6" />
              <circle cx="6" cy="6" r="2.75" fill="#ffffff" />
              <circle cx="14" cy="6" r="2.75" fill="#ffffff" />
              <circle cx="10" cy="15" r="2.75" fill="#ffffff" />
            </svg>
          </span>
          <span className="text-[17px] font-bold tracking-tight text-gray-900">Campinity</span>
        </button>

        <div className="flex flex-col gap-1 flex-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-50/90 to-indigo-50/60 text-blue-700 shadow-[inset_0_0_0_1px_rgba(91,77,255,0.12)]'
                    : 'text-gray-500 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
              {label}
              {label === 'Notifications' && unreadNotifications > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
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
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer text-left transition-all duration-150 hover:bg-white/50 border border-transparent hover:border-white/60"
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
    </div>
  )
}
