/** @type {import('tailwindcss').Config} */
const tokens = require('./src/lib/tailwind-tokens.generated.js');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Colors, type scale, radius scale generated from src/lib/tokens.ts —
      // run `npm run tokens` after editing that file, don't hand-edit here.
      colors: tokens.colors,
      fontSize: tokens.fontSize,
      borderRadius: tokens.borderRadius,
      fontFamily: {
        fraunces: ['Fraunces_600SemiBold'],
        'fraunces-medium': ['Fraunces_500Medium'],
        'fraunces-bold': ['Fraunces_700Bold'],
        dm: ['DMSans_400Regular'],
        'dm-medium': ['DMSans_500Medium'],
        'dm-semibold': ['DMSans_600SemiBold'],
        'dm-bold': ['DMSans_700Bold'],
      },
    },
  },
  plugins: [],
};
