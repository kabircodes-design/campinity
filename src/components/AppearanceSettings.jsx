import AppearanceModeCard from './AppearanceModeCard.jsx'
import ThemePackCard from './ThemePackCard.jsx'
import { useTheme } from '../theme/useTheme.js'

const MODE_OPTIONS = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'system', label: 'System', icon: '📱', description: 'Matches your device' }
]

/**
 * Drop-in replacement for the old single Dark Mode toggle inside
 * Settings — appearance mode (light/dark/system) plus theme packs, both
 * backed by ThemeProvider.
 */
export default function AppearanceSettings() {
  const { mode, setMode, themePack, setThemePack, themes } = useTheme()

  return (
    <div className="px-4 py-3 space-y-6">
      <div>
        <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide mb-2.5">Appearance</p>
        <div className="grid grid-cols-3 gap-2.5">
          {MODE_OPTIONS.map((option) => (
            <AppearanceModeCard
              key={option.id}
              icon={option.icon}
              label={option.label}
              description={option.description}
              active={mode === option.id}
              onSelect={() => setMode(option.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold theme-text-secondary uppercase tracking-wide mb-2.5">Theme Packs</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {themes.map((theme) => (
            <ThemePackCard key={theme.id} theme={theme} active={themePack.id === theme.id} onSelect={setThemePack} />
          ))}
        </div>
      </div>
    </div>
  )
}