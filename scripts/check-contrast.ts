/**
 * Verifies every text/background pairing the design system promises, in both
 * themes, against WCAG 2.1 AA.
 *
 * DESIGN.md claims "every pair clears AA"; this is the check that keeps that
 * sentence true after someone edits a hex. Translucent input and navigation
 * surfaces are checked over the original layered page gradients as well.
 *
 * Run: npx -y tsx scripts/check-contrast.ts
 */
import { BACKDROP_GRADIENTS, EDGE_ROLES, FIXED, hexToRgb, ROLES, withAlpha } from '../src/lib/tokens';

type Theme = 'light' | 'dark';

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Flattens a translucent tint over a known ground so tinted blocks are checked
 * against what the eye actually sees, not against the tint's own hex. */
function flatten(rgba: string, ground: string): string {
  const match = /rgba?\(([^)]+)\)/.exec(rgba);
  if (!match) return rgba;
  const [r, g, b, a = '1'] = match[1].split(',').map((part) => Number(part.trim()));
  const [gr, gg, gb] = hexToRgb(ground);
  const alpha = Number(a);
  const mix = (fg: number, bg: number) => Math.round(fg * alpha + bg * (1 - alpha));
  return `#${[mix(r, gr), mix(g, gg), mix(b, gb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const AA_TEXT = 4.5;
const AA_LARGE = 3;

interface Pair {
  name: string;
  fg: (theme: Theme) => string;
  bg: (theme: Theme) => string;
  min: number;
  /** Documented exception — reported, never allowed to fail the run silently. */
  exception?: string;
}

const role = (key: string) => (theme: Theme) => ROLES[key][theme];
const tint = (key: string, over: string) => (theme: Theme) => flatten(FIXED[key], ROLES[over][theme]);

const PAIRS: Pair[] = [
  { name: 'fg on bg', fg: role('fg'), bg: role('bg'), min: AA_TEXT },
  { name: 'fg on surface', fg: role('fg'), bg: role('surface'), min: AA_TEXT },
  { name: 'fg on surface-raised', fg: role('fg'), bg: role('surface-raised'), min: AA_TEXT },
  { name: 'fg-muted on bg', fg: role('fg-muted'), bg: role('bg'), min: AA_TEXT },
  { name: 'fg on surface-soft', fg: role('fg'), bg: role('surface-soft'), min: AA_TEXT },
  { name: 'fg-muted on surface', fg: role('fg-muted'), bg: role('surface'), min: AA_TEXT },
  { name: 'fg-muted on surface-soft', fg: role('fg-muted'), bg: role('surface-soft'), min: AA_TEXT },
  { name: 'fg-accent on surface-soft', fg: role('fg-accent'), bg: role('surface-soft'), min: AA_TEXT },
  { name: 'fg-accent on bg', fg: role('fg-accent'), bg: role('bg'), min: AA_TEXT },
  { name: 'fg-accent on surface', fg: role('fg-accent'), bg: role('surface'), min: AA_TEXT },
  { name: 'open on bg', fg: role('open'), bg: role('bg'), min: AA_TEXT },
  { name: 'open on surface', fg: role('open'), bg: role('surface'), min: AA_TEXT },
  { name: 'open on sage tint', fg: role('open'), bg: tint('sage', 'bg'), min: AA_TEXT },
  { name: 'vee-strong on surface', fg: role('vee-strong'), bg: role('surface'), min: AA_TEXT },
  { name: 'vee-strong on vee-tint', fg: role('vee-strong'), bg: role('vee-tint'), min: AA_TEXT },
  { name: 'warm-strong on warm', fg: role('warm-strong'), bg: role('warm'), min: AA_TEXT },
  // The pair that was missing when a tile put warm-strong on warm-tint and
  // went to 1.08:1 in dark. Every other tint family was checked; this one
  // was not, so nothing caught it.
  { name: 'warm-ink on warm-tint', fg: role('warm-ink'), bg: role('warm-tint'), min: AA_TEXT },
  // The tint is a surface in its own right, not the marigold fill — what sits on
  // it is ordinary body ink, and in dark that ink is paper, not the marigold ink.
  { name: 'fg on warm-tint', fg: role('fg'), bg: role('warm-tint'), min: AA_TEXT },
  { name: 'danger on bg', fg: role('danger'), bg: role('bg'), min: AA_TEXT },
  { name: 'fg-accent on coral-50 tint', fg: role('fg-accent'), bg: tint('coral-50', 'bg'), min: AA_TEXT },
  { name: 'fg-accent on blush tint', fg: role('fg-accent'), bg: tint('blush', 'surface'), min: AA_TEXT },
  { name: 'card-ink on surface', fg: role('card-ink'), bg: role('surface'), min: AA_TEXT },
  { name: 'card-muted on surface', fg: role('card-muted'), bg: role('surface'), min: AA_TEXT },
  { name: 'fg-muted on surface-raised', fg: role('fg-muted'), bg: role('surface-raised'), min: AA_TEXT },
  { name: 'surface-accent on surface-raised (glyph)', fg: role('surface-accent'), bg: role('surface-raised'), min: AA_LARGE },
  { name: 'fg on home-tile', fg: role('fg'), bg: role('home-tile'), min: AA_TEXT },
  { name: 'fg-muted on home-tile', fg: role('fg-muted'), bg: role('home-tile'), min: AA_TEXT },
  { name: 'home-tile-glyph on home-tile-well', fg: role('home-tile-glyph'), bg: role('home-tile-well'), min: AA_LARGE },
  { name: 'active navigation glyph on surface-navigation', fg: role('accent-fill'), bg: role('surface-navigation'), min: AA_LARGE },
  ...['surface-search', 'surface-navigation'].flatMap(surface => ['fg', 'fg-muted', 'fg-accent'].map(ink => ({ name: `${ink} on ${surface}`, fg: role(ink), bg: role(surface), min: AA_TEXT }))),
  ...['fg', 'fg-muted', 'fg-accent'].map(ink => ({ name: `${ink} on surface-discovery`, fg: role(ink), bg: role('surface-discovery'), min: AA_TEXT })),
  { name: 'on-selected on selected-surface', fg: role('on-selected'), bg: role('selected-surface'), min: AA_TEXT },
  { name: 'selected-glyph on selected-surface', fg: role('selected-glyph'), bg: role('selected-surface'), min: AA_LARGE },
  { name: 'navigation-muted on selected-surface', fg: role('navigation-muted'), bg: role('selected-surface'), min: AA_TEXT },
  ...['tile-eat', 'tile-bars', 'tile-routes', 'tile-events'].flatMap((surface) => [
    { name: `fg on ${surface}`, fg: role('fg'), bg: role(surface), min: AA_TEXT },
    { name: `fg-muted on ${surface}`, fg: role('fg-muted'), bg: role(surface), min: AA_TEXT },
  ]),
  // Non-text: a control's edge only has to separate from the ground behind it.
  { name: 'accent-fill vs bg (control edge)', fg: role('accent-fill'), bg: role('bg'), min: AA_LARGE },
  { name: 'accent vs surface (icon/border)', fg: role('accent'), bg: role('surface'), min: AA_LARGE },
  {
    name: 'on-accent on accent-fill (CTA label)',
    fg: role('on-accent'),
    bg: role('accent-fill'),
    min: AA_TEXT,
  },
];

let failures = 0;
let exceptions = 0;

for (const theme of ['light', 'dark'] as Theme[]) {
  console.log(`\n${theme.toUpperCase()}`);
  for (const pair of PAIRS) {
    const ratio = contrast(pair.fg(theme), pair.bg(theme));
    const ok = ratio >= pair.min;
    const mark = ok ? 'PASS' : pair.exception ? 'NOTE' : 'FAIL';
    if (!ok && pair.exception) exceptions += 1;
    if (!ok && !pair.exception) failures += 1;
    console.log(`  ${mark}  ${ratio.toFixed(2).padStart(5)}:1  (min ${pair.min})  ${pair.name}`);
    if (!ok && pair.exception) console.log(`        ${pair.exception}`);
  }
}

/** Sample the composited wash, rather than checking only its solid base.
 * Gradients interpolate premultiplied sRGB; each layer then composites over
 * the layers behind it. Aspect ratios cover narrow phones through desktop. */
function backdropAt(theme: Theme, width: number, height: number, x: number, y: number): string {
  let ground = hexToRgb(ROLES.bg[theme]);
  for (const layer of BACKDROP_GRADIENTS) {
    const radians = layer.angle * Math.PI / 180;
    const dx = Math.sin(radians), dy = -Math.cos(radians);
    const span = Math.abs(width * dx) + Math.abs(height * dy);
    const position = 0.5 + ((x - 0.5) * width * dx + (y - 0.5) * height * dy) / span;
    const at = Math.max(layer.locations[0], Math.min(layer.locations[2], position));
    const index = at <= layer.locations[1] ? 0 : 1;
    const amount = (at - layer.locations[index]) / (layer.locations[index + 1] - layer.locations[index]);
    const a = layer.colors[theme][index], b = layer.colors[theme][index + 1];
    const aa = parseInt(a.slice(7, 9), 16) / 255, ba = parseInt(b.slice(7, 9), 16) / 255;
    const alpha = aa * (1 - amount) + ba * amount;
    const ar = hexToRgb(a.slice(0, 7)), br = hexToRgb(b.slice(0, 7));
    ground = ground.map((channel, i) => channel * (1 - alpha) + ar[i] * aa * (1 - amount) + br[i] * ba * amount) as [number, number, number];
  }
  return `#${ground.map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

for (const theme of ['light', 'dark'] as Theme[]) {
  const samples: string[] = [];
  for (const [width, height] of [[320, 740], [390, 844], [736, 1100], [1280, 800]]) {
    for (let x = 0; x <= 20; x++) for (let y = 0; y <= 20; y++) samples.push(backdropAt(theme, width, height, x / 20, y / 20));
  }
  for (const ink of ['fg', 'fg-muted', 'fg-accent', 'open', 'danger', 'vee-strong']) {
    const minimum = Math.min(...samples.map(bg => contrast(ROLES[ink][theme], bg)));
    const ok = minimum >= AA_TEXT;
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${minimum.toFixed(2)}:1  ${theme} ${ink} on layered backdrop (${samples.length} samples)`);
  }
  for (const [surface, alpha, inks] of [
    ['surface-discovery', .66, ['fg', 'fg-muted']],
    ['surface-navigation', .97, ['fg', 'fg-muted', 'accent-fill']],
  ] as const) {
    const backgrounds=samples.map(bg=>flatten(withAlpha(ROLES[surface][theme],alpha),bg));
    for (const ink of inks) {
      const minimum=Math.min(...backgrounds.map(bg=>contrast(ROLES[ink][theme],bg)));
      const min=ink==='accent-fill'?AA_LARGE:AA_TEXT;
      const ok=minimum>=min;
      if(!ok)failures+=1;
      console.log(`${ok?'PASS':'FAIL'}  ${minimum.toFixed(2)}:1  ${theme} ${ink} on translucent ${surface} (${alpha})`);
    }
  }
}

console.log(`\nedge tokens: ${Object.keys(EDGE_ROLES).join(', ')} (opacity-based, not contrast-checked)`);
console.log(failures ? `\n${failures} failing pair(s)` : `\nAll pairs pass (${exceptions} documented exception${exceptions === 1 ? '' : 's'})`);
process.exit(failures ? 1 : 0);
