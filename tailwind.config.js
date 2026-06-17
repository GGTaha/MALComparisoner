/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0B0C',
        textMain: '#94A3B8',
        accentPurple: 'rgba(168, 85, 247, 0.2)', // border-purple-500/20
        accentEmerald: 'rgba(16, 185, 129, 0.2)', // border-emerald-500/20
      }
    },
  },
  plugins: [],
}
