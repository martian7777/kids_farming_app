/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka', 'system-ui', 'sans-serif'],
        body: ['Quicksand', 'Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        farm: {
          sky: '#bfe6ff',
          grass: '#86d36b',
          soil: '#8a5a3b',
          sun: '#ffd34e',
          leaf: '#3fa34d',
          berry: '#ff5d8f',
          sky2: '#7ec8ff',
        },
      },
      borderRadius: {
        chunky: '1.5rem',
      },
      boxShadow: {
        chunky: '0 8px 0 rgba(0,0,0,0.12), 0 14px 30px rgba(0,0,0,0.18)',
        soft: '0 10px 30px rgba(0,0,0,0.15)',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.08)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        floaty: 'floaty 3s ease-in-out infinite',
        pop: 'pop 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
