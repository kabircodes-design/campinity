import { Info, Image as ImageIcon, MessagesSquare, Settings as SettingsIcon, Users } from 'lucide-react'

const sectionIcons = {
  Posts: MessagesSquare,
  Members: Users,
  Media: ImageIcon,
  About: Info,
  Settings: SettingsIcon
}

/**
 * One nav model, two renderings — a vertical "channel list" for desktop
 * (lg+) and the existing horizontal tab strip for mobile — so adding or
 * reordering a section only happens in one place (CommunityDetailPage's
 * `sections` array), not once per breakpoint.
 */
export default function CommunitySectionNav({ sections, activeSection, onSelect, orientation, badges = {} }) {
  if (orientation === 'vertical') {
    return (
      <nav className="flex flex-col gap-0.5 p-3">
        {sections.map((section) => {
          const Icon = sectionIcons[section]
          const active = section === activeSection
          const badge = badges[section]
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSelect(section)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition-all duration-200 ${
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={active ? 2.1 : 1.8} />
              <span className="flex-1">{section}</span>
              {badge > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="flex items-center overflow-x-auto scroll-hidden border-b border-gray-100">
      {sections.map((section) => {
        const badge = badges[section]
        const active = section === activeSection
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className={`relative flex-shrink-0 px-4 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-200 ${
              active ? 'text-blue-700 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            {section}
            {badge > 0 && (
              <span className="ml-1.5 inline-flex min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold items-center justify-center align-middle">
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
