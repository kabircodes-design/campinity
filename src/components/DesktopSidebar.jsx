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
 * Rebuilt to match the reference image: flat navigation column, no
 * floating glass container/border/shadow around the whole sidebar —
 * just a plain vertical layout on the page's own background, with a
 * single subtle right-hand divider (added via the parent's border in
 * HomePage.jsx-style layout, not duplicated here since this component
 * has no outer wrapper of its own to add it to safely without seeing
 * how it's actually used in the grid). Active nav state changed from
 * a purple gradient pill to a subtle light-blue background + a small
 * blue vertical bar on the left edge, matching the reference exactly.
 * Logo gradient changed from purple/indigo to the brief's specified
 * blue. Notification badge already used blue — unchanged.
 */
export default function DesktopSidebar({ unreadNotifications = 0, profile }) {
  const navigate = useNavigate()

  return (
    <div className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 h-screen sticky top-0 px-4 py-5 border-r border-gray-100">
      <button
        type="button"
        onClick={() => navigate('/home')}
        aria-label="Campinity — go to Home"
        className="flex items-center gap-2 px-1 mb-8"
      >
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1677ff, #3b9bff)' }}
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

      <div className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-lg pl-3.5 pr-3 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
              }`
            }
          >
            {({ isActive }) =>
              isActive ? (
                <>
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-blue-600" aria-hidden="true" />
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  {label}
                  {label === 'Notifications' && unreadNotifications > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  {label}
                  {label === 'Notifications' && unreadNotifications > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </>
              )
            }
          </NavLink>
        ))}
      </div>

      {profile && (
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer text-left transition-all duration-150 bg-white border border-gray-100 hover:border-gray-200"
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
    </div>
  )
}
