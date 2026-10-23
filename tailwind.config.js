/** @type {import('tailwindcss').Config} */
export default {
  // ROOT CAUSE of app-wide dark mode failure: this was never set, so
  // Tailwind defaulted to `media` strategy (raw prefers-color-scheme,
  // ignoring any class on <html> entirely). ThemeProvider.jsx already
  // correctly toggles a real `.dark` class on <html> — with working
  // persistence and system-preference detection — but no `dark:`
  // Tailwind utility anywhere in the app could ever have responded to
  // it without this. theme-tokens.css's CSS-variable system (the
  // separate mechanism legacy theme-* / bg-white/NN components use)
  // is unaffected either way — it works via its own `html.dark`
  // selector, not Tailwind's variant generation.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: {
      xs: '390px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px'
    },
    extend: {
      // Full-viewport heights exclude the Android status-bar inset, which
      // the body already reserves as padding (theme-tokens.css) — so an
      // h-screen/h-dvh layout (Messages, Chat) still ends exactly at the
      // bottom of the screen instead of 29px below it. --app-safe-top is
      // 0px on web/desktop, so these equal plain 100vh/100dvh there.
      height: {
        screen: 'calc(100vh - var(--app-safe-top, 0px))',
        dvh: 'calc(100dvh - var(--app-safe-top, 0px))'
      },
      minHeight: {
        screen: 'calc(100vh - var(--app-safe-top, 0px))',
        dvh: 'calc(100dvh - var(--app-safe-top, 0px))'
      },
      colors: {
        bg: '#FAFAFC',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#0B0E14',
          soft: '#5B6172',
          faint: '#8A90A2'
        },
        accent: {
          DEFAULT: '#2F5FFF',
          deep: '#1530C9',
          tint: '#EEF2FF',
          glow: '#7C9CFF'
        },
        line: '#E7E9F0',
        lineSoft: '#F0F1F6'
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Inter Tight"', '"Inter"', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }]
      },
      maxWidth: {
        content: '1180px'
      },
      borderRadius: {
        xl2: '1.25rem',
        xl3: '1.75rem'
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,14,20,0.04), 0 1px 1px rgba(11,14,20,0.03)',
        cardHover: '0 8px 24px -8px rgba(21,48,201,0.18), 0 2px 6px rgba(11,14,20,0.04)',
        nav: '0 1px 0 rgba(11,14,20,0.06)'
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)'
      },
      keyframes: {
        ringPulse: {
          '0%': { transform: 'scale(0.85)', opacity: '0.55' },
          '80%': { opacity: '0' },
          '100%': { transform: 'scale(1.9)', opacity: '0' }
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      },
      animation: {
        ringPulse: 'ringPulse 3.2s cubic-bezier(0.16,1,0.3,1) infinite',
        floatSlow: 'floatSlow 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
