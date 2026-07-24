import { Check, Lock } from 'lucide-react'

const FALLBACK_PALETTE = ['#e5e7eb', '#d1d5db', '#e5e7eb', '#d1d5db']

export default function ThemePackCard({ theme, active, onSelect }) {
  const paletteColors = theme.tokens
    ? [theme.tokens.background, theme.tokens.accent, theme.tokens.card, theme.tokens.textPrimary]
    : FALLBACK_PALETTE

  return (
    <button
      type="button"
      onClick={() => !theme.locked && onSelect(theme.id)}
      disabled={theme.locked}
      aria-pressed={active}
      aria-disabled={theme.locked}
      className={`relative flex flex-col gap-2.5 rounded-2xl border-2 p-3.5 text-left transition-all duration-300 ${
        active
          ? 'border-blue-600 shadow-md shadow-blue-100'
          : theme.locked
          ? 'theme-border cursor-not-allowed'
          : 'theme-border hover:border-gray-300'
      }`}
    >
      <div className="relative">
        <div className="flex overflow-hidden rounded-xl h-14 border theme-border">
          {paletteColors.map((color, index) => (
            <span key={index} className="flex-1" style={{ backgroundColor: color }} aria-hidden="true" />
          ))}
        </div>
        {theme.locked && (
          <div className="absolute inset-0 rounded-xl bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
            <Lock className="w-4 h-4 text-gray-500" strokeWidth={2} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base flex-shrink-0" aria-hidden="true">
            {theme.icon}
          </span>
          <p className="text-sm font-semibold theme-text-primary truncate">{theme.name}</p>
        </div>

        {active && !theme.locked && (
          <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 animate-[scaleIn_200ms_ease-out]">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </span>
        )}
        {theme.locked && (
          <span className="flex-shrink-0 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5">
            Coming Soon
          </span>
        )}
      </div>
    </button>
  )
}