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
      }
    }
  },
  plugins: []
};
