import { ChevronRight } from 'lucide-react'

export default function SettingsItem({ icon: Icon, label, description, onClick, rightElement, tone = 'default' }) {
  const isDanger = tone === 'danger'
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
        onClick ? 'hover:bg-black/5 transition-all duration-300' : ''
      }`}
    >
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDanger ? 'theme-bg-danger-tint theme-text-danger' : 'theme-bg-accent-tint theme-accent'
        }`}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDanger ? 'theme-text-danger' : 'theme-text-primary'}`}>{label}</p>
        {description && <p className="text-xs theme-text-secondary mt-0.5">{description}</p>}
      </div>

      {rightElement || (onClick && <ChevronRight className="w-4 h-4 theme-text-secondary flex-shrink-0" />)}
    </Wrapper>
  )
}