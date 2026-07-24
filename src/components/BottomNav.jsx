import { Home, MessageCircle, Plus, Search, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { id: 'home', label: 'Home', icon: Home, to: '/home' },
  { id: 'search', label: 'Search', icon: Search, to: '/search' },
  { id: 'create', label: 'Create', icon: Plus, to: '/create', isCreate: true },
  { id: 'messages', label: 'Messages', icon: MessageCircle, to: '/messages' },
  { id: 'profile', label: 'Profile', icon: User, to: '/profile' }
]

/**
 * Sticky bottom navigation, centered to the same column width as the app
 * shell (max-w-[480px] / lg:max-w-[520px]) so it lines up under any page
 * built on that layout. Active state comes from NavLink's real route
 * match, not a hardcoded prop.
 */
export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] lg:max-w-[520px] theme-bg-surface backdrop-blur-md border-t theme-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 items-center px-2 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            aria-label={item.label}
            className="flex flex-col items-center justify-center py-1.5"
          >
            {({ isActive }) =>
              item.isCreate ? (
                <span className="w-8 h-8 rounded-xl theme-bg-accent flex items-center justify-center">
                  <item.icon className="w-5 h-5 theme-text-button" strokeWidth={2.4} />
                </span>
              ) : (
                <item.icon
                  className={`w-6 h-6 ${isActive ? 'theme-accent' : 'theme-text-secondary'} transition-all duration-300`}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  )
}