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
 * Palette: Copper Mist wash and matte cards in light, the original
 * Nightfall wash in dark, with restrained orange accents.
 * Filled controls use the copper/light and peach/dark pairing with
 * theme-specific on-accent ink. Legacy color aliases follow the same orange
 * family; the original gradient mark keeps its brand colors.
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
  bg: { light: '#F8F3EC', dark: '#151117' }, // copper paper beneath the wash
  // Copper Mist carries through cards and sheets. Search and
  // navigation have separate roles so their lighter treatment stays consistent.
  surface: { light: '#EFE5DA', dark: '#29252A' },
  'surface-raised': { light: '#EFE5DA', dark: '#29252A' },
  'surface-soft': { light: '#EFE5DA', dark: '#29252A' },
  'surface-control': { light: '#FFFDFA', dark: '#29252A' },
  'surface-input': { light: '#FFFDFA', dark: '#29252A' }, // text fields stay lighter than cards
  'surface-ribbon': { light: '#E9DCD2', dark: '#100D13' }, // Home ribbon and stay anchor
  'surface-search': { light: '#FFFDFA', dark: '#28372F' },
  'surface-navigation': { light: '#FFFCF7', dark: '#29252A' },
  'surface-sunk': { light: '#DFD2C6', dark: '#100D13' }, // input wells, sheet track
  fg: { light: '#34262B', dark: '#FAF2E8' }, // aubergine editorial ink
  'fg-muted': { light: '#6C5B5A', dark: '#BDAFBD' },
  'card-ink': { light: '#34262B', dark: '#F5EDE3' },
  'card-muted': { light: '#6C5B5A', dark: '#C3B9AF' },
  'surface-accent': { light: '#9F442B', dark: '#F0835C' },
  'control-edge': { light: '#DCCFC4', dark: '#4F444D' },
  'selected-surface': { light: '#39282F', dark: '#29192E' },
  'on-selected': { light: '#FFF8F1', dark: '#FFF7ED' },
  'selected-glyph': { light: '#F5BCA7', dark: '#F0835C' },
  'navigation-muted': { light: '#D8C7DD', dark: '#D8C7DD' },
  // Home's reference glyph cards use off-white; other card materials stay separate.
  'home-tile': { light: '#FCF8F2', dark: '#29252A' },
  'surface-discovery': { light: '#EFE5DA', dark: '#29252A' },
  'home-tile-glyph': { light: '#9F442B', dark: '#F0835C' },
  'home-tile-well': { light: '#E9DCD2', dark: '#48312E' },
  'tile-eat': { light: '#FCF8F2', dark: '#29252A' },
  'tile-bars': { light: '#FCF8F2', dark: '#29252A' },
  'tile-routes': { light: '#FCF8F2', dark: '#29252A' },
  'tile-events': { light: '#FCF8F2', dark: '#29252A' },
  'fg-accent': { light: '#8E3C27', dark: '#F0835C' }, // deeper copper keeps text readable on tinted cards
  // One theme-specific orange for action fills, icons, rails and active tabs.
  accent: { light: '#9F442B', dark: '#F0835C' }, // brand accent — icons, borders, rails
  'accent-fill': { light: '#9F442B', dark: '#F0835C' }, // approved editorial control fill
  'on-accent': { light: '#FFFAF4', dark: '#2C1811' }, // theme-paired CTA ink
  open: { light: '#9F442B', dark: '#F0835C' }, // open-now / confirmed / live; status stays explicit in its label
  warm: { light: '#9F442B', dark: '#F0835C' }, // legacy category fill, now the shared orange
  'warm-strong': { light: '#FFFAF4', dark: '#2C1811' }, // ink on the legacy category fill
  // Readable ink for legacy category tints.
  'warm-ink': { light: '#9F442B', dark: '#F0835C' }, // text on warm-tint
  vee: { light: '#9F442B', dark: '#F0835C' }, // legacy Vee accents, now the shared orange
  'vee-strong': { light: '#9F442B', dark: '#F0835C' }, // legacy Vee text, now the shared readable orange
  'accent-tint': { light: '#EFE5DA', dark: '#29252A' },
  'warm-tint': { light: '#EFE5DA', dark: '#29252A' },
  'vee-tint': { light: '#EFE5DA', dark: '#29252A' },
  danger: { light: '#A02F38', dark: '#FF6B6D' }, // closed / sold out / error — the one functional red
};

/** App-wide washes, painted back to front. Light matches the selected
 * Copper Mist preview; dark keeps the original Nightfall layers. Angles
 * are CSS angles, with hue-matched transparent endpoints for native fades. */
export const BACKDROP_GRADIENTS = {
  light: [
    {
      angle: 160,
      locations: [0, 0.52, 1],
      colors: ['#F8F3EC00', '#F8F3EC3D', '#F8F3EC00'],
    },
    {
      angle: 135,
      locations: [0, 0.5, 1],
      colors: ['#DD7D4E29', '#DD7D4E0F', '#DD7D4E00'],
    },
    {
      angle: 230,
      locations: [0, 0.62, 1],
      colors: ['#70557A00', '#70557A12', '#70557A00'],
    },
  ],
  dark: [
    {
      angle: 230,
      locations: [0, 0.42, 1],
      colors: ['#E85D2C1C', '#E85D2C09', '#E85D2C00'],
    },
    {
      angle: 121,
      locations: [0.16, 0.52, 0.9],
      colors: ['#6F5BD100', '#6F5BD11B', '#6F5BD100'],
    },
    {
      angle: 226,
      locations: [0.08, 0.48, 0.88],
      colors: ['#FFC75700', '#FF92710E', '#FFC75700'],
    },
  ],
} as const;

/** Roles with fixed opacity baked in (not run through <alpha-value>). Base
 * hue is fg, since edge = "a hairline of ink/paper", not its own color. */
export const EDGE_ROLES: Record<string, { base: 'fg'; alpha: number; lightBase?: string; lightAlpha?: number }> = {
  edge: { base: 'fg', alpha: 0.12 }, // borders / dividers
  'edge-soft': { base: 'fg', alpha: 0.08 }, // placeholder stripe C
  'edge-faint': { base: 'fg', alpha: 0.04 }, // quiet dividers and decorative rules
  'edge-card': { base: 'fg', alpha: 0.04, lightBase: '#5D3A2D', lightAlpha: 0.11 },
  'edge-card-bottom': { base: 'fg', alpha: 0.04, lightBase: '#5D3A2D', lightAlpha: 0.15 },
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
  light: '#EADFD4',
  dark: '#241D27',
  stripeB: { light: '#DED1C5', dark: '#2E2633' },
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
  display: ['28px', { lineHeight: '32px', letterSpacing: '-0.8px' }], // screen hero, wordmark
  title: ['21px', { lineHeight: '26px', letterSpacing: '-0.4px' }], // detail page name
  section: ['17px', { lineHeight: '22px' }], // section headers
  body: ['14px', { lineHeight: '20px' }], // descriptions
  'body-strong': ['14px', { lineHeight: '20px' }], // card titles, buttons
  label: ['12.5px', { lineHeight: '16px' }], // chips, list rows
  meta: ['11.5px', { lineHeight: '15px' }], // distance, hours, price
  'card-name': ['14px', { lineHeight: '17.22px', letterSpacing: '-0.2px' }],
  'table-name': ['18px', { lineHeight: '20.16px', letterSpacing: '-0.2px' }],
  fine: ['11px', { lineHeight: '15.4px' }],
  micro: ['9.5px', { lineHeight: '12px', letterSpacing: '0.6px' }], // eyebrows, badges (pair with uppercase)
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
  1: { blur: 8.8, y: 2.2, opacity: { light: '0.066', dark: '0.33' } },
  2: { blur: 13.2, y: 3.3, opacity: { light: '0.077', dark: '0.418' } },
  3: { blur: 17.6, y: 4.4, opacity: { light: '0.099', dark: '0.462' } },
  4: { blur: 26.4, y: 8.8, opacity: { light: '0.132', dark: '0.55' } },
};
