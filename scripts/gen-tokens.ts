/**
 * Regenerates src/global.css, src/lib/theme.ts, and
 * src/lib/tailwind-tokens.generated.js from src/lib/tokens.ts — the single
 * hand-edited source of truth for color/type/radius tokens.
 *
 * Run: npm run tokens
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { EDGE_ROLES, FIXED, hexToRgb, LEGACY_ALIASES, RADIUS, ROLES, STRIPES, TYPE_SCALE } from '../src/lib/tokens';

const ROOT = resolve(__dirname, '..');
const GENERATED_HEADER =
  '/* GENERATED FILE — edit src/lib/tokens.ts and run `npm run tokens`, do not hand-edit. */\n';

function triple(hex: string): string {
  return hexToRgb(hex).join(' ');
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function cssVarName(role: string): string {
  return `--color-${role}`;
}

function buildCssBlock(theme: 'light' | 'dark'): string {
  const lines: string[] = [];
  for (const [role, value] of Object.entries(ROLES)) {
    lines.push(`  ${cssVarName(role)}: ${triple(value[theme])};`);
  }
  for (const [role, edge] of Object.entries(EDGE_ROLES)) {
    const baseHex = ROLES[edge.base][theme];
    lines.push(`  ${cssVarName(role)}: ${rgba(baseHex, edge.alpha)};`);
  }
  return lines.join('\n');
}

function genGlobalCss(): string {
  return `${GENERATED_HEADER}@tailwind base;
@tailwind components;
@tailwind utilities;

/* Wayvee theme tokens — "Vee Coral" palette, generated from src/lib/tokens.ts.
   Light is the default (:root); dark overrides it under prefers-color-scheme,
   which NativeWind resolves on native from the system scheme too (app.json's
   userInterfaceStyle: "automatic"). RGB triples (no commas) for tokens that
   go through Tailwind's <alpha-value> opacity modifier; full rgba() strings
   for tokens with fixed baked-in opacity. */
:root {
${buildCssBlock('light')}
}

@media (prefers-color-scheme: dark) {
  :root {
${buildCssBlock('dark')}
  }
}
`;
}

function genThemeTs(): string {
  const roleKeys = Object.keys(ROLES);
  const legacyKeys = Object.keys(LEGACY_ALIASES);

  function jsKey(k: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
  }

  function resolveValue(role: string, theme: 'light' | 'dark'): string {
    if (role in ROLES) return ROLES[role][theme];
    const edge = EDGE_ROLES[role];
    return rgba(ROLES[edge.base][theme], edge.alpha);
  }

  function paletteLines(theme: 'light' | 'dark'): string {
    const lines: string[] = [];
    for (const role of roleKeys) lines.push(`    ${jsKey(role)}: ${JSON.stringify(ROLES[role][theme])},`);
    for (const role of Object.keys(EDGE_ROLES)) {
      lines.push(`    ${jsKey(role)}: ${JSON.stringify(resolveValue(role, theme))},`);
    }
    for (const [legacy, role] of Object.entries(LEGACY_ALIASES)) {
      lines.push(`    ${jsKey(legacy)}: ${JSON.stringify(resolveValue(role, theme))},`);
    }
    lines.push(`    stripeA: ${JSON.stringify(theme === 'light' ? STRIPES.light : STRIPES.dark)},`);
    lines.push(`    stripeB: ${JSON.stringify(theme === 'light' ? STRIPES.stripeB.light : STRIPES.stripeB.dark)},`);
    return lines.join('\n');
  }

  const fixedLines = Object.entries(FIXED)
    .map(([k, v]) => `  ${jsKey(k)}: ${JSON.stringify(v)},`)
    .join('\n');

  return `${GENERATED_HEADER}import { useColorScheme } from 'nativewind';

/** Mirrors the CSS-variable pairs in src/global.css ("Vee Coral" palette) — kept
 * here as plain hex because inline color props (Icon, placeholderTextColor,
 * SVG fills, shadow colors) can't read Tailwind's CSS variables the way
 * className does. Both semantic role names (bg, fg, accent, ...) and legacy
 * hue-named aliases (cream, ink, rust, ...) resolve to the same hex — reach
 * for the semantic name in new code. Source: src/lib/tokens.ts. */
const PALETTE = {
  light: {
${paletteLines('light')}
  },
  dark: {
${paletteLines('dark')}
  },
  // Fixed across both themes.
${fixedLines}
} as const;

export type ThemeColors = Record<
  keyof typeof PALETTE.light | ${Object.keys(FIXED).map((k) => JSON.stringify(k)).join(' | ')},
  string
>;

/** Current theme's resolved hex values, for the inline color props className
 * can't reach. Falls back to dark if the system scheme is unavailable. */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  const base = colorScheme === 'light' ? PALETTE.light : PALETTE.dark;
  return {
    ...base,
${Object.keys(FIXED)
  .map((k) => `    ${jsKey(k)}: PALETTE[${JSON.stringify(k)}],`)
  .join('\n')}
  };
}
`;
}

function genTailwindTokens(): string {
  const colorLines: string[] = [];
  for (const role of Object.keys(ROLES)) {
    colorLines.push(`  ${quoteKey(role)}: 'rgb(var(--color-${role}) / <alpha-value>)',`);
  }
  for (const [legacy, role] of Object.entries(LEGACY_ALIASES)) {
    const ref = role in EDGE_ROLES ? `'var(--color-${role})'` : `'rgb(var(--color-${role}) / <alpha-value>)'`;
    colorLines.push(`  ${quoteKey(legacy)}: ${ref},`);
  }
  for (const role of Object.keys(EDGE_ROLES)) {
    colorLines.push(`  ${quoteKey(role)}: 'var(--color-${role})',`);
  }
  colorLines.push(`  coral: { 50: ${JSON.stringify(FIXED['coral-50'])} },`);
  for (const [key, value] of Object.entries(FIXED)) {
    if (key === 'coral-50') continue;
    colorLines.push(`  ${quoteKey(key)}: ${JSON.stringify(value)},`);
  }

  function quoteKey(k: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
  }

  const fontSizeLines = Object.entries(TYPE_SCALE)
    .map(([name, [size, opts]]) => `  '${name}': [${JSON.stringify(size)}, ${JSON.stringify(opts)}],`)
    .join('\n');

  const radiusLines = Object.entries(RADIUS)
    .map(([name, size]) => `  ${name}: ${JSON.stringify(size)},`)
    .join('\n');

  return `${GENERATED_HEADER}/** Required by tailwind.config.js. Source: src/lib/tokens.ts. */
module.exports = {
  colors: {
${colorLines.join('\n')}
  },
  fontSize: {
${fontSizeLines}
  },
  borderRadius: {
${radiusLines}
  },
};
`;
}

writeFileSync(resolve(ROOT, 'src/global.css'), genGlobalCss());
writeFileSync(resolve(ROOT, 'src/lib/theme.ts'), genThemeTs());
writeFileSync(resolve(ROOT, 'src/lib/tailwind-tokens.generated.js'), genTailwindTokens());

console.log('tokens generated: src/global.css, src/lib/theme.ts, src/lib/tailwind-tokens.generated.js');
