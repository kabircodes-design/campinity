/**
 * Every theme pack Campinity supports — free ones fully defined now,
 * locked ones already present as placeholder objects so unlocking one
 * later is just: flip `locked` to false and fill in `tokens`. Nothing
 * else in the app needs to change to add a new theme.
 */

export const APPEARANCE_MODES = ['light', 'dark', 'system']

/**
 * Simplified back down to exactly 2 live themes per explicit direction:
 * Light (this 'default' pack) and Dark (the Mode toggle's own
 * html.dark palette in theme-tokens.css — see AppearanceSettings.jsx).
 * 'default' was removed in an earlier pass on the mistaken assumption
 * that the final set should be the 4 designed packs below — that broke
 * the actual default experience, because 'default' is the ONE pack
 * that deliberately applies NO inline token override (see
 * ThemeProvider.jsx's shouldApplyTokens check), letting the app fall
 * through to theme-tokens.css's own :root/html.dark blocks — the
 * ORIGINAL blue Campinity palette (#1677ff accent), untouched by any
 * of this theme-pack work the whole time. Removing the 'default' pack
 * meant the fallback pack became whichever pack was first in this
 * array instead (Romantic), which DOES apply an inline override —
 * that's the actual root cause of "default theme is now pink."
 *
 * Romantic/Dark(navy)/Vintage/Greenish are NOT deleted — their full
 * token definitions stay exactly as designed, just flipped to
 * locked:true, so they're hidden from the picker and cannot become the
 * active theme, while remaining trivially re-enabled later (flip
 * locked back to false) with zero further work. 'ocean'/'lavender'/
 * 'halloween'/'christmas' remain untouched, locked placeholders.
 */
export const THEMES = [
  {
    id: 'default',
    name: 'Light',
    icon: '🎓',
    locked: false,
    description: "Campinity's original blue.",
    // Cosmetic preview values only (ThemePackCard's 4-color swatch) —
    // this pack applies NO inline override (see ThemeProvider.jsx), so
    // the app itself is always actually colored by theme-tokens.css's
    // :root (light) / html.dark (dark) blocks, not by this object. Kept
    // identical to those real values so the preview swatch is honest,
    // not because anything reads this at runtime.
    tokens: {
      background: '#f7f8fc',
      surface: '#ffffff',
      card: '#ffffff',
      border: '#eef1f6',
      textPrimary: '#10131a',
      textSecondary: '#4a5568',
      accent: '#1677ff',
      accentText: '#ffffff',
      danger: '#ef4444',
      success: '#10b981',
      notification: '#5b4dff',
      button: '#5b4dff',
      buttonText: '#ffffff'
    }
  },
  {
    id: 'romantic',
    name: 'Romantic',
    icon: '💗',
    locked: true,
    description: 'Soft pink ice-cream, coral accents.',
    tokens: {
      background: '#fdf1f0',
      surface: '#ffffff',
      card: '#fef4f2',
      border: '#f6d9d3',
      textPrimary: '#3a2620',
      textSecondary: '#8a6f68',
      accent: '#ef6c52',
      accentText: '#ffffff',
      danger: '#dc4c64',
      success: '#5fa77a',
      notification: '#ef6c52',
      button: '#ef6c52',
      buttonText: '#ffffff',
      accentDeep: '#d14e36',
      accentSecondary: '#f5a28c',
      backgroundSecondary: '#fce8e6',
      surfaceElevated: '#ffffff',
      glass: 'rgba(239, 108, 82, 0.08)',
      glassBorder: 'rgba(239, 108, 82, 0.16)',
      primaryHover: '#f5a28c',
      secondary: '#fce0dc',
      divider: '#f6d9d3',
      muted: '#b79992',
      warning: '#d97706',
      gradientPrimary: 'linear-gradient(135deg, #ef6c52, #f5a28c)',
      gradientSecondary: 'linear-gradient(135deg, #fdf1f0, #fce0dc)',
      shadowSoft: '0 8px 24px rgba(239, 108, 82, 0.10)',
      shadowStrong: '0 20px 48px rgba(209, 78, 54, 0.16)',
      glow: '0 0 40px rgba(245, 162, 140, 0.28)',
      overlay: 'rgba(58, 38, 32, 0.45)',
      backdrop: 'rgba(253, 241, 240, 0.78)',
      focusRing: '0 0 0 3px rgba(239, 108, 82, 0.35)'
    }
  },
  {
    id: 'midnight',
    name: 'Dark (navy)',
    icon: '🌙',
    locked: true,
    description: 'Deep navy and grey, cool and premium.',
    tokens: {
      background: '#06141b',
      surface: '#11212d',
      card: '#11212d',
      border: '#253745',
      textPrimary: '#ccd0cf',
      textSecondary: '#9ba8ab',
      accent: '#9ba8ab',
      accentText: '#06141b',
      danger: '#b85c56',
      success: '#5c8f7a',
      notification: '#9ba8ab',
      button: '#9ba8ab',
      buttonText: '#06141b',
      accentDeep: '#4a5c6a',
      accentSecondary: '#ccd0cf',
      backgroundSecondary: '#0a1820',
      surfaceElevated: '#172936',
      glass: 'rgba(155, 168, 171, 0.08)',
      glassBorder: 'rgba(204, 208, 207, 0.14)',
      primaryHover: '#ccd0cf',
      secondary: '#1a2c38',
      divider: '#253745',
      muted: '#6e7c82',
      warning: '#c99a4e',
      gradientPrimary: 'linear-gradient(135deg, #4a5c6a, #9ba8ab)',
      gradientSecondary: 'linear-gradient(135deg, #06141b, #11212d)',
      shadowSoft: '0 8px 24px rgba(0, 0, 0, 0.45)',
      shadowStrong: '0 24px 56px rgba(0, 0, 0, 0.6)',
      glow: '0 0 48px rgba(155, 168, 171, 0.25)',
      overlay: 'rgba(2, 6, 9, 0.65)',
      backdrop: 'rgba(6, 20, 27, 0.78)',
      focusRing: '0 0 0 3px rgba(204, 208, 207, 0.4)'
    }
  },
  {
    id: 'vintage',
    name: 'Vintage',
    icon: '📻',
    locked: true,
    description: 'Cream paper, cocoa and wine tones.',
    tokens: {
      background: '#fcf4e3',
      surface: '#fcf4e3',
      card: '#ede0c9',
      border: '#dfc9a0',
      textPrimary: '#3f151a',
      textSecondary: '#7a4a3a',
      accent: '#844c3b',
      accentText: '#fcf4e3',
      danger: '#8c2f26',
      success: '#5f7a4f',
      notification: '#844c3b',
      button: '#844c3b',
      buttonText: '#fcf4e3',
      accentDeep: '#5c2f22',
      accentSecondary: '#a66b4f',
      backgroundSecondary: '#f6ead3',
      surfaceElevated: '#fffbf3',
      glass: 'rgba(132, 76, 59, 0.08)',
      glassBorder: 'rgba(132, 76, 59, 0.18)',
      primaryHover: '#a66b4f',
      secondary: '#ede0c9',
      divider: '#dfc9a0',
      muted: '#a08769',
      warning: '#b3452c',
      gradientPrimary: 'linear-gradient(135deg, #844c3b, #a66b4f)',
      gradientSecondary: 'linear-gradient(135deg, #fcf4e3, #ede0c9)',
      shadowSoft: '0 8px 24px rgba(63, 21, 26, 0.12)',
      shadowStrong: '0 20px 48px rgba(63, 21, 26, 0.2)',
      glow: '0 0 40px rgba(166, 107, 79, 0.25)',
      overlay: 'rgba(63, 21, 26, 0.45)',
      backdrop: 'rgba(252, 244, 227, 0.8)',
      focusRing: '0 0 0 3px rgba(132, 76, 59, 0.35)'
    }
  },
  {
    id: 'forest',
    name: 'Greenish',
    icon: '🌲',
    locked: true,
    description: 'Fresh mint and forest green.',
    tokens: {
      background: '#f0f7f2',
      surface: '#ffffff',
      card: '#ffffff',
      border: '#d3e6da',
      textPrimary: '#1e2e27',
      textSecondary: '#5c7268',
      accent: '#2f4a3d',
      accentText: '#ffffff',
      danger: '#c1554a',
      success: '#3f8f63',
      notification: '#2f4a3d',
      button: '#2f4a3d',
      buttonText: '#ffffff',
      accentDeep: '#1f332a',
      accentSecondary: '#7fa893',
      backgroundSecondary: '#e3f0e7',
      surfaceElevated: '#ffffff',
      glass: 'rgba(47, 74, 61, 0.08)',
      glassBorder: 'rgba(47, 74, 61, 0.16)',
      primaryHover: '#3e6252',
      secondary: '#e3f0e7',
      divider: '#d3e6da',
      muted: '#8fa69a',
      warning: '#e8a45d',
      gradientPrimary: 'linear-gradient(135deg, #2f4a3d, #3e6252)',
      gradientSecondary: 'linear-gradient(135deg, #f0f7f2, #e3f0e7)',
      shadowSoft: '0 8px 24px rgba(47, 74, 61, 0.10)',
      shadowStrong: '0 20px 48px rgba(31, 51, 42, 0.18)',
      glow: '0 0 40px rgba(127, 168, 147, 0.28)',
      overlay: 'rgba(30, 46, 39, 0.45)',
      backdrop: 'rgba(240, 247, 242, 0.78)',
      focusRing: '0 0 0 3px rgba(47, 74, 61, 0.35)'
    }
  },
  { id: 'ocean', name: 'Ocean', icon: '🌊', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'lavender', name: 'Lavender', icon: '💜', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'halloween', name: 'Halloween', icon: '🎃', locked: true, description: 'Coming soon.', tokens: null },
  { id: 'christmas', name: 'Christmas', icon: '🎄', locked: true, description: 'Coming soon.', tokens: null }
]

export function getThemeById(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0]
}
