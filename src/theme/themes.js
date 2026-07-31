/**
 * Every theme pack Campinity supports — free ones fully defined now,
 * locked ones already present as placeholder objects so unlocking one
 * later is just: flip `locked` to false and fill in `tokens`. Nothing
 * else in the app needs to change to add a new theme.
 */

export const APPEARANCE_MODES = ['light', 'dark', 'system']

export const THEMES = [
  {
    id: 'default',
    name: 'Default',
    icon: '🎓',
    locked: false,
    description: "Campinity's classic look.",
    tokens: {
      background: '#f9fafb',
      surface: '#ffffff',
      card: '#ffffff',
      border: '#f3f4f6',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      accent: '#2563eb',
      accentText: '#ffffff',
      danger: '#ef4444',
      success: '#10b981',
      notification: '#2563eb',
      button: '#2563eb',
      buttonText: '#ffffff'
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    icon: '🌙',
    locked: false,
    description: 'Pure AMOLED black, blue accents.',
    tokens: {
      background: '#000000',
      surface: '#000000',
      card: '#000000',
      border: '#1a1a1a',
      textPrimary: '#f5f5f5',
      textSecondary: '#9a9a9a',
      accent: '#2563eb',
      accentText: '#ffffff',
      danger: '#ef4444',
      success: '#10b981',
      notification: '#2563eb',
      button: '#2563eb',
      buttonText: '#ffffff'
    }
  },
  {
    id: 'vintage',
    name: 'Vintage',
    icon: '📻',
    locked: false,
    description: 'Warm cream, cozy brown tones.',
    tokens: {
      background: '#f5efe6',
      surface: '#efe6d8',
      card: '#efe6d8',
      border: '#e0d2ba',
      textPrimary: '#3d2b1f',
      textSecondary: '#7a6552',
      accent: '#8b5e34',
      accentText: '#ffffff',
      danger: '#b3452c',
      success: '#5f7a4f',
      notification: '#8b5e34',
      button: '#8b5e34',
      buttonText: '#fdf8f0'
    }
  },
  {
    id: 'romantic',
    name: 'Romantic',
    icon: '💗',
    locked: false,
    description: 'Soft pink, rose accents.',
    tokens: {
      background: '#fff5f7',
      surface: '#ffffff',
      card: '#fff0f3',
      border: '#fbd5e0',
      textPrimary: '#3a1f28',
      textSecondary: '#8a6470',
      accent: '#e0507a',
      accentText: '#ffffff',
      danger: '#e0507a',
      success: '#5fa77a',
      notification: '#e0507a',
      button: '#e0507a',
      buttonText: '#ffffff'
    }
  },
  {
    id: 'traditional',
    name: 'Traditional',
    icon: '🎯',
    locked: false,
    description: 'Professional orange and blue.',
    tokens: {
      background: '#f7f9fc',
      surface: '#ffffff',
      card: '#ffffff',
      border: '#e2e8f0',
      textPrimary: '#1a202c',
      textSecondary: '#4a5568',
      accent: '#1d4ed8',
      accentText: '#ffffff',
      danger: '#dc2626',
      success: '#059669',
      notification: '#ea580c',
      button: '#1d4ed8',
      buttonText: '#ffffff'
    }
  },
  { id: 'ocean', name: 'Ocean', icon: '🌊', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'forest', name: 'Forest', icon: '🌲', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'lavender', name: 'Lavender', icon: '💜', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'halloween', name: 'Halloween', icon: '🎃', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'christmas', name: 'Christmas', icon: '🎄', locked: true, description: 'Coming soon.', tokens: null }
]

export function getThemeById(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0]
}
