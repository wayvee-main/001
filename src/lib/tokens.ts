/**
 * Wayvee design tokens — ONLY hand-edited file in the token system.
 * `npm run tokens` regenerates:
 *   - src/global.css              (CSS vars, web + native via NativeWind)
 *   - src/lib/theme.ts            (hex palette for inline color props)
 *   - src/lib/tailwind-tokens.generated.js  (colors/fontSize/borderRadius for tailwind.config.js)
 *
 * Role names are semantic (what it's FOR), not hue names (what it LOOKS
 * like) — "accent" not "rust", because the hue has now moved three times (rust to
 * teal to marquee amber to Vee coral) without the CTA's job changing. Old hue-named
 * aliases are kept pointing at the same hex so existing className strings in src/app
 * and src/components keep working; new code should reach for the semantic name.
 *
 * Palette: Aurora. Warm paper (light) and plum night (dark) grounds lit by the
 * Vee spiral's gold → ember → violet. Solid roles below stay hex so Tailwind's
 * opacity modifier keeps working; gradients, glow, frosted surfaces and section
 * rules live in AURORA. Solid pastel metadata pills keep dark ink in both
 * themes. Legacy color aliases follow the ember accent.
 */

export type ThemeValue = { light: string; dark: string };

/** Shared by the generator and any runtime code (shadows) that needs to turn
 * a token hex into an rgba() string. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

/** Resolve a translucent theme color for native and web surfaces. */
export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`;
}

/** Solid, theme-varying roles. Values are hex — the generator emits them as
 * space-separated RGB triples so Tailwind's <alpha-value> opacity modifier
 * (bg-surface/50) keeps working. */
export const ROLES: Record<string, ThemeValue> = {
  bg: { light: '#FFFAF6', dark: '#120E13' }, // Daybreak primary ground
  // Local Perks cards use a dedicated matte surface. Search and
  // navigation have separate roles so their lighter treatment stays consistent.
  surface: { light: '#FFFFFF', dark: '#1C171E' },
  'surface-raised': { light: '#FFFFFF', dark: '#1C171E' },
  'surface-soft': { light: '#FFFFFF', dark: '#1C171E' },
  'surface-control': { light: '#FFFFFF', dark: '#251F28' },
  'surface-input': { light: '#FFFFFF', dark: '#251F28' }, // text fields stay lighter than cards
  'surface-ribbon': { light: '#FFD0A3', dark: '#6A3B1B' }, // Home ribbon and stay anchor
  'surface-poster': { light: '#FFE7D4', dark: '#503222' },
  'poster-edge': { light: '#F0DAC8', dark: '#6A4330' },
  'surface-search': { light: '#FFFFFF', dark: '#251F28' },
  'surface-navigation': { light: '#FFFFFF', dark: '#1C171E' },
  'surface-sunk': { light: '#F4ECE8', dark: '#2A232D' }, // input wells, sheet track
  fg: { light: '#1F1720', dark: '#F7EEF3' }, // aubergine editorial ink
  'fg-muted': { light: '#5F5361', dark: '#CABDC7' },
  'card-ink': { light: '#1F1720', dark: '#F7EEF3' },
  'card-muted': { light: '#5F5361', dark: '#CABDC7' },
  // Solid pastel metadata: color follows meaning, with dark ink in both themes.
  'metadata-category': { light: '#F4D4C0', dark: '#D8B7A0' },
  'metadata-category-ink': { light: '#704125', dark: '#4D2E1C' },
  'metadata-distance': { light: '#DCE8FA', dark: '#BFCFE5' },
  'metadata-distance-ink': { light: '#334C70', dark: '#293E5C' },
  'metadata-menu': { light: '#DDE9CF', dark: '#C8D9BA' },
  'metadata-menu-ink': { light: '#354B2B', dark: '#293F21' },
  'metadata-offer': { light: '#FFE7AB', dark: '#E7CC9D' },
  'metadata-offer-ink': { light: '#654719', dark: '#50370F' },
  'surface-accent': { light: '#B8400F', dark: '#FFA370' },
  'control-edge': { light: '#E9DEE3', dark: '#3A3140' },
  'selected-surface': { light: '#C2470F', dark: '#FFA370' },
  'on-selected': { light: '#FFFFFF', dark: '#3C1D0E' },
  'selected-glyph': { light: '#FFFFFF', dark: '#3C1D0E' },
  'navigation-muted': { light: '#FFFFFF', dark: '#3C1D0E' },
  // Home's reference glyph cards use off-white; other card materials stay separate.
  'home-tile': { light: '#FFFFFF', dark: '#1C171E' },
  'surface-discovery': { light: '#FFFFFF', dark: '#1C171E' },
  'home-tile-glyph': { light: '#B8400F', dark: '#FFA370' },
  'home-tile-well': { light: '#FCEDE6', dark: '#3A2630' },
  'tile-eat': { light: '#FFFFFF', dark: '#1C171E' },
  'tile-bars': { light: '#FFFFFF', dark: '#1C171E' },
  'tile-routes': { light: '#FFFFFF', dark: '#1C171E' },
  'tile-events': { light: '#FFFFFF', dark: '#1C171E' },
  'fg-accent': { light: '#B8400F', dark: '#FFA370' }, // deeper accent keeps small text readable on tints
  // One theme-specific orange for action fills, icons, rails and active tabs.
  accent: { light: '#B8400F', dark: '#FFA370' }, // brand accent — icons, borders, rails
  'accent-fill': { light: '#C2470F', dark: '#FFA370' }, // approved editorial control fill
  'on-accent': { light: '#FFFFFF', dark: '#3C1D0E' }, // theme-paired CTA ink
  open: { light: '#AE3C0E', dark: '#FFA370' }, // open-now / confirmed / live; status stays explicit in its label
  warm: { light: '#B8400F', dark: '#FFA370' }, // legacy category fill, now the shared orange
  'warm-strong': { light: '#FFFFFF', dark: '#3C1D0E' }, // ink on the legacy category fill
  // Readable ink for legacy category tints.
  'warm-ink': { light: '#B8400F', dark: '#FFA370' }, // text on warm-tint
  vee: { light: '#B8400F', dark: '#FFA370' }, // legacy Vee accents, now the shared orange
  'vee-strong': { light: '#B8400F', dark: '#FFA370' }, // legacy Vee text, now the shared readable orange
  'accent-tint': { light: '#FCEDE6', dark: '#3A2630' },
  'warm-tint': { light: '#FCEDE6', dark: '#3A2630' },
  'vee-tint': { light: '#FCEDE6', dark: '#3A2630' },
  'page-secondary': { light: '#F8F1EE', dark: '#17121A' },
  'page-tertiary': { light: '#FFFCFA', dark: '#1F1922' },
  'ribbon-ink': { light: '#74300D', dark: '#FFDCAC' },
  danger: { light: '#A02F38', dark: '#FF6B6D' }, // closed / sold out / error — the one functional red
};

/** Aurora's non-solid values, resolved per theme by useAurora() (src/lib/aurora.ts).
 * Every stop that carries text is audited by scripts/check-contrast.ts:
 * - fill: gradient behind filled controls; onFill is their label ink (≥ 4.5:1 at every stop).
 * - text: gradient headline phrases, large type only (≥ 3:1 on bg at every stop).
 * - glow: the screen-top light, decorative (hex + opacity so SVG stops render everywhere).
 * - soft: low-alpha tint behind icon badges; glass: translucent frosted surface over the glow. */
export type AuroraStop = { color: string; opacity: number };
export const AURORA: Record<'light' | 'dark', {
  fill: readonly [string, string, string]; onFill: string; text: readonly [string, string, string];
  glow: readonly [AuroraStop, AuroraStop, AuroraStop]; soft: readonly [string, string, string];
  glass: string; glassEdge: string; rule: string; navigation: string; shadow: string;
}> = {
  light: {
    fill: ['#C2470F', '#96486C', '#6A4AC9'], onFill: '#FFFFFF',
    text: ['#D9581C', '#A23E8C', '#6A4AC9'],
    glow: [{ color: '#FFBA54', opacity: 0.55 }, { color: '#F0642F', opacity: 0.26 }, { color: '#7B5AD6', opacity: 0.3 }],
    soft: ['rgba(255, 181, 71, 0.22)', 'rgba(240, 100, 47, 0.15)', 'rgba(123, 90, 214, 0.18)'],
    glass: 'rgba(255, 255, 255, 0.74)', glassEdge: 'rgba(70, 30, 60, 0.09)', rule: 'rgba(70, 30, 60, 0.10)',
    navigation: 'rgba(255, 255, 255, 0.94)', shadow: '0 14px 30px -16px rgba(60, 20, 50, 0.30)',
  },
  dark: {
    fill: ['#FFC56B', '#FF9468', '#B9A4FF'], onFill: '#1C1018',
    text: ['#FFC56B', '#FF8A5B', '#B9A4FF'],
    glow: [{ color: '#FFBA54', opacity: 0.2 }, { color: '#F0642F', opacity: 0.3 }, { color: '#7B5AD6', opacity: 0.44 }],
    soft: ['rgba(255, 181, 71, 0.16)', 'rgba(240, 100, 47, 0.14)', 'rgba(123, 90, 214, 0.22)'],
    glass: 'rgba(38, 31, 42, 0.66)', glassEdge: 'rgba(255, 240, 250, 0.09)', rule: 'rgba(255, 240, 250, 0.10)',
    navigation: 'rgba(32, 26, 35, 0.95)', shadow: '0 18px 36px -20px rgba(0, 0, 0, 0.92)',
  },
};
/** Photo scrim under overlay text and the avatar ring, identical in both themes. */
export const AURORA_FIXED = {
  scrim: ['rgba(14, 8, 16, 0.10)', 'rgba(14, 8, 16, 0)', 'rgba(14, 8, 16, 0.88)'] as const,
  ring: ['#FFC757', '#E85D2C', '#6F5BD1'] as const,
  photoFallback: '#2A2030',
  onPhoto: '#FFFFFF',
};

/** Local Perks uses opaque, matte page grounds. Retain this typed export for
 * the contrast audit and any previous gradient-aware consumers. */
export const BACKDROP_GRADIENTS: Record<'light' | 'dark', readonly {
  angle: number; locations: readonly [number, number, number]; colors: readonly [string, string, string];
}[]> = { light: [], dark: [] };

/** Roles with fixed opacity baked in (not run through <alpha-value>). Base
 * hue is fg, since edge = "a hairline of ink/paper", not its own color. */
export const EDGE_ROLES: Record<string, { base: 'fg'; alpha: number; lightBase?: string; lightAlpha?: number }> = {
  edge: { base: 'fg', alpha: 0.12 }, // borders / dividers
  'edge-soft': { base: 'fg', alpha: 0.08 }, // placeholder stripe C
  'edge-faint': { base: 'fg', alpha: 0.04 }, // quiet dividers and decorative rules
  'edge-card': { base: 'fg', alpha: 0.12, lightBase: '#855A40', lightAlpha: 0.10 },
  'edge-card-bottom': { base: 'fg', alpha: 0.12, lightBase: '#855A40', lightAlpha: 0.10 },
};

/** Same value in both themes — either brand hue or a translucent tint over
 * a fixed hue that reads fine on either ground. */
export const FIXED: Record<string, string> = {
  forest: '#4C2E22', // deep verified / outdoor surface block
  night: '#3D261F', // culture / venue surface block — plum ink
  blush: 'rgba(184,70,36,0.14)', // tinted accent surface
  blush2: 'rgba(184,70,36,0.09)', // placeholder stripe B
  sage: 'rgba(184,70,36,0.13)', // quiet confirmed tint, paired with open
  mist: 'rgba(61,38,31,0.4)', // quiet culture tint
  apricot: 'rgba(184,70,36,0.20)', // warm offer tint, derived from warm
  'coral-50': 'rgba(184,70,36,0.11)', // light accent surface
};

/** Non-CSS-var palette entries theme.ts also needs (Stripes placeholder). */
export const STRIPES: ThemeValue & { stripeB: ThemeValue } = {
  light: '#F4ECE8',
  dark: '#251F28',
  stripeB: { light: '#EADFDD', dark: '#332A37' },
};

/** Old hue-named tokens, kept as aliases of the semantic roles above so
 * existing className strings (bg-cream, text-ink, border-sand, ...) keep
 * resolving. Remove once every call site has migrated to the semantic name. */
export const LEGACY_ALIASES: Record<string, string> = {
  cream: 'bg',
  ink: 'fg',
  taupe: 'fg-muted',
  shell: 'surface-raised',
  rust: 'accent',
  ember: 'accent-fill',
  peach: 'fg-accent',
  pine: 'open',
  ochre: 'warm',
  coralDark: 'warm-strong',
  sand: 'edge',
  sand2: 'edge-soft',
};

/** Type scale: 8 steps replacing 27 ad-hoc text-[Npx] sizes. Values are
 * [fontSize, { lineHeight, letterSpacing }] — Tailwind's fontSize tuple
 * form, so tracking travels with the size instead of being re-typed at
 * every call site. Weight comes from the font-dm/-medium/-bold or
 * font-fraunces class already in use, not from this scale. */
export const TYPE_SCALE: Record<string, [string, { lineHeight: string; letterSpacing?: string }]> = {
  display: ['32px', { lineHeight: '36px', letterSpacing: '-0.8px' }], // screen hero, wordmark
  title: ['21px', { lineHeight: '26px', letterSpacing: '-0.4px' }], // detail page name
  section: ['20px', { lineHeight: '26px', letterSpacing: '-0.6px' }], // section headers
  body: ['14px', { lineHeight: '20px' }], // descriptions
  'body-strong': ['14px', { lineHeight: '20px' }], // card titles, buttons
  label: ['12.5px', { lineHeight: '16px' }], // chips, list rows
  meta: ['11.5px', { lineHeight: '15px' }], // distance, hours, price
  'card-name': ['14px', { lineHeight: '17.22px', letterSpacing: '-0.2px' }],
  'table-name': ['18px', { lineHeight: '20.16px', letterSpacing: '-0.2px' }],
  fine: ['11px', { lineHeight: '15.4px' }],
  micro: ['11px', { lineHeight: '15px', letterSpacing: '0.6px' }], // eyebrows, badges (pair with uppercase)
};

/** Radius scale: 4 steps replacing 9 ad-hoc rounded-[Npx] values. `pill` is
 * just Tailwind's built-in `rounded-full`, not repeated here. */
export const RADIUS: Record<string, string> = {
  control: '12px', // buttons, option pills, inputs, small thumbnails
  card: '17px', // approved Essential containment
  setting: '18px', // editorial place / preference rows
  stat: '21px', // Profile count cards
  panel: '22px', // option cards, ribbons, the stay anchor
  sheet: '25px', // the Vee hero, bottom sheets, modals
};

/** Elevation scale: 4 levels replacing the old hardcoded warm-brown
 * `CARD_SHADOW`/`POSTER_SHADOW` (which read as a stray warm cast on the cool
 * cool palette, and were invisible on dark surfaces since low-opacity
 * dark shadows don't separate from an already-dark background). Tint is
 * resolved from semantic roles at render time (see src/lib/shadows.ts): ink
 * in light mode and the deepest surface in dark, preventing a bright halo. */
/** All four elevation levels are 10% stronger: lift, blur and opacity. */
export const ELEVATION: Record<number, { blur: number; y: number; opacity: ThemeValue }> = {
  1: { blur: 9, y: 3, opacity: { light: '0.035', dark: '0.10' } },
  2: { blur: 13.2, y: 3.3, opacity: { light: '0.077', dark: '0.418' } },
  3: { blur: 17.6, y: 4.4, opacity: { light: '0.099', dark: '0.462' } },
  4: { blur: 26.4, y: 8.8, opacity: { light: '0.132', dark: '0.55' } },
};
