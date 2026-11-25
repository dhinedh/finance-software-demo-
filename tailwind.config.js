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
        navy: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          200: '#c3d9eb',
          300: '#94bde0',
          400: '#5f9cd0',
          500: '#387ec0',
          600: '#2765a4',
          700: '#205185',
          800: '#1d446e',
          900: '#0f2942',
          950: '#0a1a2b',
        },
        brand: {
          dark: '#0a192f',
          navy: '#1e3a5f',
          accent: '#2563eb',
          light: '#f8fafc',
          card: '#ffffff'
        }
      }
    },
  },
  plugins: [],
}
