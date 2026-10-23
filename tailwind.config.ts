import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1.25rem', md: '2rem', xl: '3rem' }, screens: { '2xl': '1360px' } },
    extend: {
      colors: {
        ink: { DEFAULT: '#0F2430', soft: '#2A3F4B', mute: '#5B6B73' },
        sea: { DEFAULT: '#17677A', deep: '#0C4655', light: '#CFE5E8', mist: '#E8F2F2' },
        sand: { DEFAULT: '#F5EFE5', deep: '#EADFCB', paper: '#FBF8F2' },
        terra: { DEFAULT: '#A9532F', deep: '#9C4529', light: '#F3DDD2' },
        olive: { DEFAULT: '#66703F', light: '#E4E7D3' },
        sun: { DEFAULT: '#D49A2E', light: '#F6E7C4' },
        line: '#E3DACB',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.75rem, 6.2vw, 5.75rem)', { lineHeight: '1.02', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2.25rem, 4.4vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
        'display-md': ['clamp(1.75rem, 3vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'display-sm': ['clamp(1.375rem, 2vw, 1.875rem)', { lineHeight: '1.18' }],
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(15,36,48,.04), 0 8px 24px -8px rgba(15,36,48,.10)',
        lift: '0 2px 4px rgba(15,36,48,.05), 0 24px 48px -16px rgba(15,36,48,.22)',
        inset: 'inset 0 0 0 1px rgba(15,36,48,.08)',
      },
      transitionTimingFunction: { swift: 'cubic-bezier(.22,1,.36,1)' },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        drift: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(6px)' } },
      },
      animation: {
        marquee: 'marquee var(--marquee-duration, 60s) linear infinite',
        drift: 'drift 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
