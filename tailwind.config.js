/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gravity: {
          bg: '#0C0D0E',
          surface1: '#131417',
          surface2: '#18191D',
          surface3: '#1F2026',
          surface4: '#272930',
          surface5: '#32343E',
          border: 'rgba(255, 255, 255, 0.08)',
          borderStrong: 'rgba(255, 255, 255, 0.16)',
          borderHover: 'rgba(255, 255, 255, 0.24)',
          text: '#EDEDED',
          secondary: '#9DA1AA',
          muted: '#5F636E',
          dim: '#43464F',
          accent: '#FFFFFF',
          error: '#B85858',
          errorBg: 'rgba(184, 88, 88, 0.08)',
          errorBorder: 'rgba(184, 88, 88, 0.25)',
        }
      },
      fontFamily: {
        sans: ['Onest', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'sm': '7px',
        'md': '10px',
        'lg': '14px',
        'full': '9999px',
      },
      boxShadow: {
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
