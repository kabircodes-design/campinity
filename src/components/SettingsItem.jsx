import { ChevronRight } from 'lucide-react'

/**
 * Plain Tailwind (blue-50/blue-600, red-50/red-600, gray-900/gray-400)
 * instead of theme-* tokens — matching HomePage.jsx/DiscoverCommunitiesPage.jsx
 * exactly, same reasoning as SettingsPage.jsx's own rewrite (see that
 * file's comment): this was the one shared component making every
 * Settings row visually diverge from the rest of the app depending on
 * the active theme pack, regardless of what wrapped it.
 */
export default function SettingsItem({ icon: Icon, label, description, onClick, rightElement, tone = 'default' }) {
  const isDanger = tone === 'danger'
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
        onClick ? 'hover:bg-gray-50 transition-all duration-300' : ''
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDanger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
        }`}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDanger ? 'text-red-600' : 'text-gray-900'}`}>{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>

      {rightElement || (onClick && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />)}
    </Wrapper>
  )
}