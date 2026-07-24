import { Check } from 'lucide-react'

export default function AppearanceModeCard({ icon, label, description, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`relative flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3.5 text-left transition-all duration-300 ${
        active
          ? 'border-blue-600 bg-blue-50/60 shadow-md shadow-blue-100'
          : 'theme-border theme-bg-surface hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
        {active && (
          <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center animate-[scaleIn_200ms_ease-out]">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="text-sm font-semibold theme-text-primary mt-1">{label}</p>
      {description && <p className="text-[11px] theme-text-secondary leading-tight">{description}</p>}
    </button>
  )
}