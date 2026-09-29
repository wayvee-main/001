// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**'],
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
  },
  {
    // Radius scale (see src/lib/tokens.ts + DESIGN.md) replaced the app's ad-hoc
    // rounded-[Npx] values — new code should reach for rounded-control/card/sheet
    // instead of inventing another one-off radius. Genuine outliers get an
    // eslint-disable-next-line with a reason, not a new arbitrary value.
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/rounded(-[tblr]{1,2})?-\\[[0-9]+px\\]/]',
          message: 'Use the radius scale (rounded-control/card/sheet, or rounded-full for pills) instead of an arbitrary rounded-[Npx] value. See DESIGN.md.',
        },
        {
          selector: 'TemplateElement[value.raw=/rounded(-[tblr]{1,2})?-\\[[0-9]+px\\]/]',
          message: 'Use the radius scale (rounded-control/card/sheet, or rounded-full for pills) instead of an arbitrary rounded-[Npx] value. See DESIGN.md.',
        },
      ],
    },
  },
]);
