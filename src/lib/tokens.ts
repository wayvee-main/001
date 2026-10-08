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
 * Palette: "Vee Coral" — coral #E85D2C, marigold #FFC757 and cobalt #6F5BD1 over a
 * paper/canvas ground, taken from the approved onboarding + home reference build.
 *
 * Two rules this palette enforces, both load-bearing:
 *
 * `accent` is not text. Coral on paper is 3.4:1 — fine for a fill, a border, an icon
 * or a progress rail, short of AA for a sentence. Accent *text* is `fg-accent`
 * (#A14325 light / #FF9271 dark), which clears AA on both `bg` and `surface`. The
 * one deliberate exception is white on `accent-fill`: the coral CTA is the approved
 * brand button, and darkening it to reach 4.5:1 would change the brand. It is
 * documented in DESIGN.md rather than silently "fixed" here.
 *
 * `warm` is a fill, never a lettering color. Marigold is 1.7:1 on paper — it exists
 * to be sat on, and anything sitting on it uses `warm-strong`.
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
  // Approved Editorial Home: exact palette from the selected reference.
  // Scoped roles keep other screens on their existing palette.
  'editorial-paper': { light: '#FFFDF8', dark: '#17131B' },
  'editorial-ink': { light: '#291E33', dark: '#FFF9F1' },
  'editorial-muted': { light: '#776C77', dark: '#BDAFBD' },
  'editorial-surface': { light: '#F1EDE5', dark: '#28212E' },
  'editorial-soft': { light: '#F8F5EF', dark: '#211B26' },
  'editorial-line': { light: '#E8E1D7', dark: '#453A4C' },
  'editorial-coral': { light: '#C24824', dark: '#FF9A78' },
  'editorial-fill': { light: '#ED602F', dark: '#F47648' },
  'editorial-on-fill': { light: '#FFFDF8', dark: '#24160F' },
  'editorial-violet': { light: '#6550BC', dark: '#BEACFF' },
  'editorial-dark': { light: '#271A32', dark: '#211629' },
  'editorial-on-dark': { light: '#FFF9F0', dark: '#FFF9F0' },
  'editorial-dark-muted': { light: '#D3C4D8', dark: '#D3C4D8' },
  'editorial-photo-shade': { light: '#110818', dark: '#110818' },
  'editorial-shadow': { light: '#241527', dark: '#000000' },
  bg: { light: '#FFFDFA', dark: '#151117' }, // screen background — paper / plum-black
  surface: { light: '#F0EBE3', dark: '#251E29' }, // card surface — warm canvas / lifted plum
  // Reads *above* the card in light by staying paper-white and *below* it in dark by going
  // deeper. Both directions separate it from `surface`, which is the job — matching the
  // direction across themes is not, and forcing that would flatten one theme or the other.
  'surface-raised': { light: '#FFFDFA', dark: '#1B161E' }, // ask bar, peek rows
  // The lightest card tier — about a quarter of `surface`'s separation from the
  // page. For the run of cards that opens Home (Vee's hero, its pick, the stay
  // anchor), which lead the screen and shouldn't feel heavy before any content
  // has appeared. Deliberately close to `bg`: these read as shaped areas of the
  // page rather than as objects on it. Anything that needs to read as a distinct
  // object wants `surface`.
  'surface-soft': { light: '#FBF8F4', dark: '#372E3C' },
  'surface-sunk': { light: '#E7E0D6', dark: '#100D13' }, // input wells, sheet track
  fg: { light: '#2A1B33', dark: '#FFFDFA' }, // primary text/icon — plum ink
  'fg-muted': { light: '#716672', dark: '#B8AAB5' }, // secondary text/icon
  'fg-accent': { light: '#A14325', dark: '#FF9271' }, // accent TEXT on surfaces — see the note below
  // A shade under the CTA's coral so it still clears 3:1 as an icon or border on
  // `surface`, which the exact CTA hex does not (2.93:1). The CTA keeps the
  // approved hex below; this is the role that has to survive being drawn small.
  accent: { light: '#E45526', dark: '#FF9271' }, // brand accent — icons, borders, rails
  'accent-fill': { light: '#E85D2C', dark: '#E85D2C' }, // CTA background — approved coral, both themes
  'on-accent': { light: '#FFFFFF', dark: '#FFFFFF' }, // text/icon on accent-fill
  open: { light: '#38714F', dark: '#83D0A8' }, // open-now / confirmed / live
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
  danger: { light: '#C93537', dark: '#FF6B6D' }, // closed / sold out / error — the one functional red
};

/** Roles with fixed opacity baked in (not run through <alpha-value>). Base
 * hue is fg, since edge = "a hairline of ink/paper", not its own color. */
export const EDGE_ROLES: Record<string, { base: 'fg'; alpha: number }> = {
  edge: { base: 'fg', alpha: 0.12 }, // borders / dividers
  'edge-soft': { base: 'fg', alpha: 0.08 }, // placeholder stripe C
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
  micro: ['9.5px', { lineHeight: '12px', letterSpacing: '0.6px' }], // eyebrows, badges (pair with uppercase)
};

/** Radius scale: 4 steps replacing 9 ad-hoc rounded-[Npx] values. `pill` is
 * just Tailwind's built-in `rounded-full`, not repeated here. */
export const RADIUS: Record<string, string> = {
  control: '12px', // buttons, option pills, inputs, small thumbnails
  card: '18px', // poster/venue/list cards, peek rows
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
