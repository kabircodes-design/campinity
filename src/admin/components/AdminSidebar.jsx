import { NavLink } from 'react-router-dom'
import { LayoutGrid, Flag, Image, GraduationCap, ShieldCheck, Gavel, PackageSearch, ShoppingBag, Bell, History, LogOut } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { adminLogout } from '../services/adminAuthService.js'

const NAV_ITEMS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'reports', label: 'Reports', icon: Flag },
  { key: 'photo-verification', label: 'Photo Verification', icon: Image },
  { key: 'college-requests', label: 'College Requests', icon: GraduationCap },
  { key: 'user-verification', label: 'User Verification', icon: ShieldCheck },
  { key: 'moderation', label: 'Moderation', icon: Gavel },
  { key: 'lost-found', label: 'Lost & Found', icon: PackageSearch },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'audit-log', label: 'Audit Log', icon: History }
]

/**
 * A section-switcher inside the single /admin route, not real
 * react-router sub-routes — AdminPage.jsx owns which section is
 * active via simple useState, since the entire dashboard only exists
 * behind the in-memory unlocked flag anyway (a route change wouldn't
 * survive it meaningfully differently than state does). Kept simple
 * per the brief's own "do not overengineer" instruction.
 */
export default function AdminSidebar({ activeSection, onSelectSection }) {
  const { sessionToken, logout } = useAdminSession()

  const handleLock = async () => {
    await adminLogout(sessionToken).catch(() => {})
    logout()
  }

  return (
    <div className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 h-screen sticky top-0 px-4 py-5 border-r border-gray-100">
      <p className="px-1 mb-8 text-[17px] font-bold tracking-tight text-gray-900">Campinity Admin</p>

      <div className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectSection(key)}
            className={`flex items-center gap-3 rounded-lg pl-3.5 pr-3 py-2.5 text-[14px] font-medium text-left transition-all duration-200 ${
              activeSection === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleLock}
        className="flex items-center gap-3 rounded-lg pl-3.5 pr-3 py-2.5 text-[14px] font-medium text-left text-gray-500 hover:bg-gray-50 transition-all duration-200"
      >
        <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
        Lock Panel
      </button>
    </div>
  )
}
