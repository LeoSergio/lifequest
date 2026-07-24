/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta base do RPG doméstico — ajustar depois com a identidade visual
        bg: '#0f0f14',
        surface: '#181820',
        primary: '#7c5cff',
        xp: '#ffb100',
        danger: '#ff4d6d'
      },
      animation: {
        blob: "blob 15s infinite",
      },
      keyframes: {
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
      }
    }
  },
  plugins: []
};
