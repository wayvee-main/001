/** @type {import('tailwindcss').Config} */
const tokens = require('./src/lib/tailwind-tokens.generated.js');

module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Colors, type scale, radius scale generated from src/lib/tokens.ts —
      // run `npm run tokens` after editing that file, don't hand-edit here.
      colors: tokens.colors,
      fontSize: tokens.fontSize,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      fontFamily: {
        // Keep the existing semantic weight aliases while every screen uses
        // the approved Daybreak family, including secondary/detail layers.
        fraunces: ['Outfit_500Medium'],
        'fraunces-medium': ['Outfit_500Medium'],
        'fraunces-bold': ['Outfit_700Bold'],
        dm: ['Outfit_400Regular'],
        'dm-medium': ['Outfit_500Medium'],
        'dm-bold': ['Outfit_700Bold'],
      },
    },
  },
  plugins: [],
};
