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
 * Palette: Local Perks warm paper, white matte cards and compact apricot ribbons;
 * opaque Nightfall grounds in dark, with restrained orange accents.
 * Filled controls use the smoke/light and peach/dark pairing with
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
  bg: { light: '#F6F3EC', dark: '#100E13' }, // Local Perks primary ground
  // Local Perks cards use a dedicated matte surface. Search and
  // navigation have separate roles so their lighter treatment stays consistent.
  surface: { light: '#FFFFFF', dark: '#2B242B' },
  'surface-raised': { light: '#FFFFFF', dark: '#2B242B' },
  'surface-soft': { light: '#FFFFFF', dark: '#2B242B' },
  'surface-control': { light: '#FFFFFF', dark: '#2E252F' },
  'surface-input': { light: '#FFFFFF', dark: '#2E252F' }, // text fields stay lighter than cards
  'surface-ribbon': { light: '#EBD4BD', dark: '#2C222C' }, // Home ribbon and stay anchor
  'surface-search': { light: '#FFFFFF', dark: '#2E252F' },
  'surface-navigation': { light: '#FFFCF7', dark: '#1A141D' },
  'surface-sunk': { light: '#E8E2D8', dark: '#17131B' }, // input wells, sheet track
  fg: { light: '#2D2925', dark: '#F6ECE0' }, // aubergine editorial ink
  'fg-muted': { light: '#64584F', dark: '#BDAFBA' },
  'card-ink': { light: '#2D2925', dark: '#F6ECE0' },
  'card-muted': { light: '#64584F', dark: '#BDAFBA' },
  // Color Dock metadata: color follows the fact's meaning across every card.
  'metadata-category': { light: '#F8DECA', dark: '#493428' },
  'metadata-category-ink': { light: '#7F452A', dark: '#F2CAB0' },
  'metadata-distance': { light: '#DFECDC', dark: '#2B3F32' },
  'metadata-distance-ink': { light: '#3A6048', dark: '#BFDBBF' },
  'metadata-menu': { light: '#DFE9F6', dark: '#2B3B51' },
  'metadata-menu-ink': { light: '#3C5E84', dark: '#C5D8F2' },
  'metadata-offer': { light: '#F5E6B5', dark: '#4A3F26' },
  'metadata-offer-ink': { light: '#70541E', dark: '#F2DCA0' },
  'surface-accent': { light: '#AE512E', dark: '#E6AA78' },
  'control-edge': { light: '#D5C8B8', dark: '#4C3D49' },
  'selected-surface': { light: '#302923', dark: '#E6AA78' },
  'on-selected': { light: '#FFF9EF', dark: '#2B1C12' },
  'selected-glyph': { light: '#FFF9EF', dark: '#2B1C12' },
  'navigation-muted': { light: '#FFF9EF', dark: '#2B1C12' },
  // Home's reference glyph cards use off-white; other card materials stay separate.
  'home-tile': { light: '#FFFFFF', dark: '#2B242B' },
  'surface-discovery': { light: '#FFFFFF', dark: '#2B242B' },
  'home-tile-glyph': { light: '#AE512E', dark: '#E6AA78' },
  'home-tile-well': { light: '#F0DDC7', dark: '#392A2B' },
  'tile-eat': { light: '#FFFFFF', dark: '#2B242B' },
  'tile-bars': { light: '#FFFFFF', dark: '#2B242B' },
  'tile-routes': { light: '#FFFFFF', dark: '#2B242B' },
  'tile-events': { light: '#FFFFFF', dark: '#2B242B' },
  'fg-accent': { light: '#98431F', dark: '#E6AA78' }, // deeper accent keeps small text readable on tints
  // One theme-specific orange for action fills, icons, rails and active tabs.
  accent: { light: '#AE512E', dark: '#E6AA78' }, // brand accent — icons, borders, rails
  'accent-fill': { light: '#AE512E', dark: '#E6AA78' }, // approved editorial control fill
  'on-accent': { light: '#FFF9F0', dark: '#2C1D13' }, // theme-paired CTA ink
  open: { light: '#98431F', dark: '#E6AA78' }, // open-now / confirmed / live; status stays explicit in its label
  warm: { light: '#AE512E', dark: '#E6AA78' }, // legacy category fill, now the shared orange
  'warm-strong': { light: '#FFF9F0', dark: '#2C1D13' }, // ink on the legacy category fill
  // Readable ink for legacy category tints.
  'warm-ink': { light: '#98431F', dark: '#E6AA78' }, // text on warm-tint
  vee: { light: '#AE512E', dark: '#E6AA78' }, // legacy Vee accents, now the shared orange
  'vee-strong': { light: '#98431F', dark: '#E6AA78' }, // legacy Vee text, now the shared readable orange
  'accent-tint': { light: '#F0DDC7', dark: '#392A2B' },
  'warm-tint': { light: '#F0DDC7', dark: '#392A2B' },
  'vee-tint': { light: '#F0DDC7', dark: '#392A2B' },
  'page-secondary': { light: '#E8E2D8', dark: '#17131B' },
  'page-tertiary': { light: '#FFFDF8', dark: '#201B22' },
  'ribbon-ink': { light: '#3D2B20', dark: '#F8EADC' },
  danger: { light: '#A02F38', dark: '#FF6B6D' }, // closed / sold out / error — the one functional red
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
  'edge-card': { base: 'fg', alpha: 0.12, lightBase: '#8A715C', lightAlpha: 0.22 },
  'edge-card-bottom': { base: 'fg', alpha: 0.12, lightBase: '#8A715C', lightAlpha: 0.22 },
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
  light: '#E7E4E0',
  dark: '#241D27',
  stripeB: { light: '#D6D2CE', dark: '#2E2633' },
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
