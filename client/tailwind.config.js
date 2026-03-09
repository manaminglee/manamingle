/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Space Grotesk', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        realm: {
          void: '#070811',
          surface: '#0d0f1c',
          card: '#12152a',
          border: 'rgba(99, 102, 241, 0.12)',
          muted: 'rgba(232, 234, 246, 0.45)',
          teal: '#14b8a6',
          mint: '#2dd4bf',
          coral: '#f43f5e',
          gold: '#f59e0b',
          amber: '#f59e0b',
          glow: 'rgba(99, 102, 241, 0.15)',
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        'gradient-teal': 'linear-gradient(135deg, #14b8a6, #06b6d4)',
        'gradient-hero': 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(99,102,241,0.15), transparent)',
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease-out both',
        'fade-in-up': 'fade-in-up 0.6s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'bounce-dot': 'bounce-dot 1.2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.4s ease-out both',
        'message-pop': 'message-pop 0.25s ease-out both',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'connecting': 'connecting-pulse 2s ease infinite',
        'shimmer': 'shimmer 1.5s linear infinite',
        'dot-pulse': 'dot-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '70%': { transform: 'scale(1.15)', opacity: '0' },
          '100%': { transform: 'scale(1.15)', opacity: '0' },
        },
        'bounce-dot': {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '50%': { transform: 'translateY(-8px)', opacity: '1' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(30px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'message-pop': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'connecting-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0.5)' },
          '50%': { boxShadow: '0 0 0 16px rgba(99, 102, 241, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'dot-pulse': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.2)' },
        },
      },
      boxShadow: {
        'glow-indigo': '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.3)',
        'glow-red': '0 0 20px rgba(244, 63, 94, 0.3)',
        'card': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};
