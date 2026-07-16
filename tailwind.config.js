/** @type {import('tailwindcss').Config} */
export default {
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
