/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6fe',
          100: '#ddeafd',
          200: '#c3dbfc',
          300: '#9bc4fa',
          400: '#6ca4f6',
          500: '#4882f0',
          600: '#3264e4',
          700: '#274fcf',
          800: '#1e3a8a', // Corporate Navy Primary Accent
          900: '#1e346f',
          950: '#172244',
        },
        slate: {
          850: '#182234',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
