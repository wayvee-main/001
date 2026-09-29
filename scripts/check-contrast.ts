/**
 * Verifies every text/background pairing the design system promises, in both
 * themes, against WCAG 2.1 AA.
 *
 * DESIGN.md claims "every pair clears AA"; this is the check that keeps that
 * sentence true after someone edits a hex. One pairing is a documented,
 * deliberate exception (white on the approved coral CTA) and is reported as
 * such rather than quietly excluded.
 *
 * Run: npx -y tsx scripts/check-contrast.ts
 */
import { EDGE_ROLES, FIXED, hexToRgb, ROLES } from '../src/lib/tokens';

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
  // The tint is a surface in its own right, not the marigold fill — what sits on
  // it is ordinary body ink, and in dark that ink is paper, not the marigold ink.
  { name: 'fg on warm-tint', fg: role('fg'), bg: role('warm-tint'), min: AA_TEXT },
  { name: 'danger on bg', fg: role('danger'), bg: role('bg'), min: AA_TEXT },
  { name: 'fg-accent on coral-50 tint', fg: role('fg-accent'), bg: tint('coral-50', 'bg'), min: AA_TEXT },
  { name: 'fg-accent on blush tint', fg: role('fg-accent'), bg: tint('blush', 'surface'), min: AA_TEXT },
  // Non-text: a control's edge only has to separate from the ground behind it.
  { name: 'accent-fill vs bg (control edge)', fg: role('accent-fill'), bg: role('bg'), min: AA_LARGE },
  { name: 'accent vs surface (icon/border)', fg: role('accent'), bg: role('surface'), min: AA_LARGE },
  {
    name: 'on-accent on accent-fill (CTA label)',
    fg: role('on-accent'),
    bg: role('accent-fill'),
    min: AA_TEXT,
    exception:
      'Approved brand coral. White on #E85D2C is 3.55:1 — clears AA for large/UI text, short of it for body. ' +
      'Darkening the fill to reach 4.5:1 would change the brand, so the CTA is the one documented exception.',
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

// The fill-only rule for marigold, asserted rather than trusted to a comment.
// Light is where it is load-bearing: marigold on paper is unreadable, so any
// change that makes it *look* usable as text is the dangerous one to catch.
// (In dark, marigold on plum-black is legible — the rule still holds there, but
// as a design decision rather than a contrast fact.)
const warmOnPaper = contrast(ROLES.warm.light, ROLES.bg.light);
if (warmOnPaper >= AA_TEXT) {
  console.log(`\nFAIL  'warm' now reads as text on paper (${warmOnPaper.toFixed(2)}:1) — revisit the fill-only rule.`);
  failures += 1;
} else {
  console.log(`\nfill-only rule holds: 'warm' on paper is ${warmOnPaper.toFixed(2)}:1, unusable as text by design`);
}

console.log(`\nedge tokens: ${Object.keys(EDGE_ROLES).join(', ')} (opacity-based, not contrast-checked)`);
console.log(failures ? `\n${failures} failing pair(s)` : `\nAll pairs pass (${exceptions} documented exception${exceptions === 1 ? '' : 's'})`);
process.exit(failures ? 1 : 0);
