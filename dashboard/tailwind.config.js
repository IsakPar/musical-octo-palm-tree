/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TradingView Dark Theme Colors
        tv: {
          // Backgrounds
          'bg-primary': '#131722',
          'bg-secondary': '#1e222d',
          'bg-tertiary': '#2a2e39',
          'bg-hover': '#363a45',

          // Text
          'text-primary': '#d1d4dc',
          'text-secondary': '#787b86',
          'text-tertiary': '#5d606b',

          // Borders
          'border': '#363a45',
          'border-light': '#434651',

          // Accents
          'blue': '#2962ff',
          'blue-hover': '#1e53e4',
          'green': '#26a69a',
          'green-bright': '#00c853',
          'red': '#ef5350',
          'red-bright': '#ff5252',
          'yellow': '#ffeb3b',
          'orange': '#ff9800',
          'purple': '#ab47bc',

          // Light theme overrides
          'light-bg-primary': '#ffffff',
          'light-bg-secondary': '#f0f3fa',
          'light-bg-tertiary': '#e0e3eb',
          'light-text-primary': '#131722',
          'light-text-secondary': '#787b86',
          'light-border': '#e0e3eb',
        }
      },
      fontFamily: {
        'mono': ['SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', 'Source Code Pro', 'monospace'],
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Trebuchet MS', 'Roboto', 'Ubuntu', 'sans-serif'],
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
