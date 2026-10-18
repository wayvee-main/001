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
 * Palette: original layered peach/lilac backdrop, warm off-white in light,
 * plum-black in dark, with warm cream/cocoa editorial cards and sage Home tiles.
 * Filled controls use the approved rust/light and peach/dark pairing with
 * theme-specific on-accent ink. Brand accent and warm fills remain distinct
 * from readable supporting text roles.
 */

export type ThemeValue = { light: string; dark: string };

/** Shared by the generator and any runtime code (shadows) that needs to turn
 * a token hex into an rgba() string. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

/** Solid, theme-varying roles. Values are hex — the generator emits them as
 * space-separated RGB triples so Tailwind's <alpha-value> opacity modifier
 * (bg-surface/50) keeps working. */
export const ROLES: Record<string, ThemeValue> = {
  bg: { light: '#FFFDFA', dark: '#151117' }, // original ground beneath the wash
  // The approved ribbon material carries through cards, banners, controls and
  // sheets. Elevation and faint edges establish hierarchy over the page wash.
  surface: { light: '#F5E6D7', dark: '#403029' },
  'surface-raised': { light: '#F5E6D7', dark: '#403029' },
  'surface-soft': { light: '#F5E6D7', dark: '#403029' },
  'surface-sunk': { light: '#E7E0D6', dark: '#100D13' }, // input wells, sheet track
  fg: { light: '#312039', dark: '#FAF2E8' }, // Nightfall editorial ink
  'fg-muted': { light: '#605463', dark: '#BDAFBD' }, // AA across the original wash
  'card-ink': { light: '#2D2926', dark: '#F5EDE3' },
  'card-muted': { light: '#645D56', dark: '#C3B9AF' },
  ribbon: { light: '#F5E6D7', dark: '#403029' },
  'surface-accent': { light: '#995435', dark: '#EFB590' }, // glyphs on warm cards/ribbons
  'ribbon-edge': { light: '#DBCFE0', dark: '#493C50' },
  'control-edge': { light: '#E0D5C9', dark: '#493C50' },
  'selected-surface': { light: '#2B1C35', dark: '#29192E' },
  'on-selected': { light: '#FFF7ED', dark: '#FFF7ED' },
  'selected-glyph': { light: '#F5B494', dark: '#F5B494' },
  'navigation-muted': { light: '#D8C7DD', dark: '#D8C7DD' },
  // One shared green for Home's four tiles; the stay chip keeps tile-eat.
  'home-tile': { light: '#E9EEE4', dark: '#29362F' },
  'home-tile-glyph': { light: '#50684D', dark: '#A9C2A3' },
  'home-tile-well': { light: '#F6F7F1', dark: '#313E37' },
  'tile-eat': { light: '#F2E8CA', dark: '#493E2E' },
  'tile-bars': { light: '#F2DFDF', dark: '#493342' },
  'tile-routes': { light: '#E6DEEF', dark: '#3A3047' },
  'tile-events': { light: '#E2EBDF', dark: '#2C4139' },
  'fg-accent': { light: '#963B25', dark: '#FF9271' }, // readable accent text across the wash
  // A shade under the CTA's coral so it still clears 3:1 as an icon or border on
  // `surface`, which the exact CTA hex does not (2.93:1). The CTA keeps the
  // approved hex below; this is the role that has to survive being drawn small.
  accent: { light: '#E45526', dark: '#FF9271' }, // brand accent — icons, borders, rails
  'accent-fill': { light: '#B84624', dark: '#F0835C' }, // approved editorial control fill
  'on-accent': { light: '#FFFAF4', dark: '#2C1811' }, // theme-paired CTA ink
  open: { light: '#37604B', dark: '#83D0A8' }, // open-now / confirmed / live
  warm: { light: '#FFC757', dark: '#FFC757' }, // marigold — FILL ONLY, never text (see below)
  'warm-strong': { light: '#543F18', dark: '#3D2D10' }, // ink on a marigold FILL — not on warm-tint
  // The marigold family's answer to fg-accent and vee-strong: text and icons
  // on warm-tint. warm-strong cannot do this job — it is sized for the bright
  // fill, so in dark it is near-black on a near-black tint (1.08:1).
  'warm-ink': { light: '#543F18', dark: '#F5C98C' }, // text on warm-tint
  vee: { light: '#6F5BD1', dark: '#A896FF' }, // Vee's cobalt — fills, borders, icons
  'vee-strong': { light: '#5D4BAA', dark: '#C5BAFF' }, // cobalt as text
  'accent-tint': { light: '#FBE4DA', dark: '#4A2A25' }, // coral-tinted block
  'warm-tint': { light: '#FFF3D8', dark: '#403321' }, // marigold-tinted block
  'vee-tint': { light: '#E3DFF7', dark: '#352C4D' }, // cobalt-tinted block
  danger: { light: '#A02F38', dark: '#FF6B6D' }, // closed / sold out / error — the one functional red
};

/** Original app-wide wash from the earlier preview's --wf-wash. Paint in this
 * back-to-front order. Angles are CSS angles; stops include their original
 * alpha, with hue-matched transparent endpoints to avoid muddy native fades. */
export const BACKDROP_GRADIENTS = [
  {
    angle: 230,
    locations: [0, 0.42, 1],
    colors: {
      light: ['#FCBA7875', '#FAC8A633', '#FFFDFA00'],
      dark: ['#E85D2C1C', '#E85D2C09', '#E85D2C00'],
    },
  },
  {
    angle: 121,
    locations: [0.16, 0.52, 0.9],
    colors: {
      light: ['#6F5BD100', '#806CD82B', '#6F5BD100'],
      dark: ['#6F5BD100', '#6F5BD11B', '#6F5BD100'],
    },
  },
  {
    angle: 226,
    locations: [0.08, 0.48, 0.88],
    colors: {
      light: ['#FFC75700', '#FA8E6621', '#FFC75700'],
      dark: ['#FFC75700', '#FF92710E', '#FFC75700'],
    },
  },
] as const;

/** Roles with fixed opacity baked in (not run through <alpha-value>). Base
 * hue is fg, since edge = "a hairline of ink/paper", not its own color. */
export const EDGE_ROLES: Record<string, { base: 'fg'; alpha: number }> = {
  edge: { base: 'fg', alpha: 0.12 }, // borders / dividers
  'edge-soft': { base: 'fg', alpha: 0.08 }, // placeholder stripe C
  'edge-faint': { base: 'fg', alpha: 0.04 }, // raised cards and controls
};

/** Same value in both themes — either brand hue or a translucent tint over
 * a fixed hue that reads fine on either ground. */
export const FIXED: Record<string, string> = {
  forest: '#24463B', // deep verified / outdoor surface block
  night: '#2A1B33', // culture / venue surface block — plum ink
  blush: 'rgba(232,93,44,0.14)', // tinted accent surface
  blush2: 'rgba(232,93,44,0.09)', // placeholder stripe B
  sage: 'rgba(59,119,86,0.13)', // quiet confirmed tint, paired with open
  mist: 'rgba(42,27,51,0.4)', // quiet culture tint
  apricot: 'rgba(255,199,87,0.20)', // warm offer tint, derived from warm
  'coral-50': 'rgba(232,93,44,0.11)', // light accent surface
};

/** Non-CSS-var palette entries theme.ts also needs (Stripes placeholder). */
export const STRIPES: ThemeValue & { stripeB: ThemeValue } = {
  light: '#EDE7DE',
  dark: '#241D27',
  stripeB: { light: '#E2DAD0', dark: '#2E2633' },
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
export const ELEVATION: Record<number, { blur: number; y: number; opacity: ThemeValue }> = {
  1: { blur: 8, y: 2, opacity: { light: '0.06', dark: '0.30' } }, // thumbnails, list rows
  2: { blur: 12, y: 3, opacity: { light: '0.07', dark: '0.38' } }, // default card
  3: { blur: 16, y: 4, opacity: { light: '0.09', dark: '0.42' } }, // hero/detail image
  4: { blur: 24, y: 8, opacity: { light: '0.12', dark: '0.50' } }, // sheet, modal, floating
};
