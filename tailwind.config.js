/** @type {import('tailwindcss').Config} */

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      fontFamily: {
          'rajdhani': ['Rajdhani', 'cursive']
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],
  daisyui: {
    themes: [
      'business',
      'aqua',
      'corporate',
      {
        bsLight: {
          primary: '#2563eb',
          'primary-content': '#d2e2ff',
          secondary: '#0369a1',
          'secondary-content': '#d1e0ed',
          accent: '#8b5cf6',
          'accent-content': '#070315',
          neutral: '#1e3a8a',
          'neutral-content': '#cdd6e9',
          'base-100': '#e5e7eb',
          'base-200': '#c7c9cc',
          'base-300': '#aaabae',
          'base-content': '#121313',
          info: '#38bdf8',
          'info-content': '#010d15',
          success: '#22c55e',
          'success-content': '#000e03',
          warning: '#f97316',
          'warning-content': '#150500',
          error: '#e11d48',
          'error-content': '#ffd8d9',
        },
      },
    ],
  },
}
