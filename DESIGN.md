# Wayvee design system

Source of truth: [src/lib/tokens.ts](src/lib/tokens.ts). Edit that file, then
run `npm run tokens` — it regenerates:

- `src/global.css` — CSS vars (web + native via NativeWind)
- `src/lib/theme.ts` — hex palette for inline color props (`Icon`, SVG fill,
  `placeholderTextColor`, shadow colors) that can't read a CSS var
- `src/lib/tailwind-tokens.generated.js` — colors/fontSize/borderRadius
  consumed by `tailwind.config.js`

Never hand-edit the three generated files — the header comment says so, and
the next `npm run tokens` overwrites them anyway.

## Why semantic names

Old tokens were named after hue (`rust`, `peach`, `ochre`). The brand accent
already moved three times — rust-orange to teal to marquee amber to Vee coral —
without its *job* (primary CTA) changing, so the name should describe the job,
not the color. New code reaches for the semantic role name below; the old hue
names still work as aliases during migration.

**Vee Coral**: coral, marigold and cobalt over a paper-and-canvas ground — the
palette of the approved onboarding and home reference build. Coral is the CTA
and the concierge; marigold and cobalt are its two supporting signals (marigold
for a category badge or an avatar, cobalt for "Vee picked this"); everything
else is paper, canvas and ink. Roughly 20% of the screen carries colour at all,
with full strength reserved for Vee and primary actions.

| Semantic | Legacy alias | Light | Dark | Use |
|---|---|---|---|---|
| `bg` | `cream` | #FFFDFA | #151117 | screen background |
| `surface` | `shell` | #F0EBE3 | #251E29 | card surface |
| `surface-raised` | — | #FFFDFA | #1B161E | ask bar, peek rows |
| `surface-soft` | — | #FBF8F4 | #372E3C | lightest card tier — the cards that open Home |
| `surface-sunk` | — | #E7E0D6 | #100D13 | input wells, sheet track |
| `fg` | `ink` | #2A1B33 | #FFFDFA | primary text/icon |
| `fg-muted` | `taupe` | #716672 | #B8AAB5 | secondary text/icon |
| `fg-accent` | `peach` | #A14325 | #FF9271 | accent **text** on surfaces |
| `accent` | `rust` | #E45526 | #FF9271 | icons, borders, rails |
| `accent-fill` | `ember` | #E85D2C | #E85D2C | CTA background |
| `on-accent` | — | #FFFFFF | #FFFFFF | text/icon on accent-fill |
| `open` | `pine` | #38714F | #83D0A8 | open-now / confirmed / live |
| `warm` | `ochre` | #FFC757 | #FFC757 | marigold — **fill only** |
| `warm-strong` | `coralDark` | #543F18 | #3D2D10 | ink on a marigold fill |
| `vee` | — | #6F5BD1 | #A896FF | Vee's cobalt — fills, borders, icons |
| `vee-strong` | — | #5D4BAA | #C5BAFF | cobalt as text |
| `accent-tint` | — | #FBE4DA | #4A2A25 | coral-tinted block |
| `warm-tint` | — | #FFF3D8 | #403321 | marigold-tinted block |
| `vee-tint` | — | #E3DFF7 | #352C4D | cobalt-tinted block |
| `danger` | — | #C93537 | #FF6B6D | closed / sold out / error |
| `edge` | `sand` | ink/12% | paper/12% | borders / dividers |
| `edge-soft` | `sand2` | ink/8% | paper/8% | hairlines, placeholder stripe C |

Fixed (same value both themes): `forest`, `night`, `blush`, `blush2`, `sage`,
`mist`, `apricot`, `coral-50`.

Note that `bg` is *lighter* than `surface` in light mode: cards are warm canvas
on paper, not white on grey. `surface-soft` sits between the two — about a quarter of
the separation `surface` has from `bg` — for blocks that should read as shaped
areas of the page rather than as objects on it. In light that is a 1.04:1 step,
deliberately at the edge of perceptible, so cards on this tier carry elevation 1
there to keep from reading as flush. In dark the tier is *lighter* than the page
(1.44:1) and separates on fill alone, so the shadow is withheld — a dark shadow
on a dark ground reads as a halo, not a lift. Anything that needs to read as a
distinct object wants `surface`. `surface-raised` is the third level, and it reads
above the card in light (staying paper-white) but below it in dark (going
deeper). Both directions separate it from `surface`, which is the job; matching
the direction across themes is not.

### Three rules this palette enforces

**`accent` is not text.** The coral is 3.4:1 on paper — enough for a fill, a
border, an icon or a progress rail, short of AA for a sentence. Accent text is
`fg-accent`. The role is also a shade under the CTA hex, because the exact CTA
coral misses even the 3:1 non-text floor on `surface` (2.93:1).

**`warm` is a fill, never a lettering colour.** Marigold is 1.53:1 on paper. It
exists to be sat on; what sits on it is `warm-strong`.

**`accent` and `vee` must never be the only difference between two things.**
They separate by hue, so pair each with an icon or a label and the difference
survives colourblindness and grayscale.

### The one documented exception

White on `accent-fill` is **3.48:1** — it clears AA for large and UI text and
misses it for body copy. The coral CTA is the approved brand button, and
darkening it far enough to reach 4.5:1 would change the brand, so this is
recorded as a deliberate exception rather than silently "fixed". Keep CTA labels
at `text-body-strong` or larger and bold.

Everything else clears AA in both themes: text ≥4.5:1, non-text/UI ≥3:1.
`npm run tokens:contrast` re-verifies every pair and fails on a regression — run
it after changing any hex.

## Typeface

One family: **Hanken Grotesk** at 400/500/600/700. The Fraunces + DM Sans
serif/sans pairing is gone. The `font-fraunces*` class names survive as the
display-weight aliases and `font-dm*` as the text-weight ones, so the ~440
existing call sites kept working when the family moved — only what they point at
changed. See `tailwind.config.js`.

## Type scale

Replaces 27 ad-hoc `text-[Npx]` sizes seen across the codebase with 8 named
steps. Use as Tailwind classes: `text-display`, `text-title`, etc. Tracking
travels with the size (Tailwind's fontSize tuple form), so `text-micro`
already carries its letter-spacing — pair with `uppercase` and
`font-dm-bold`, don't re-add `tracking-[...]` at the call site.

| Class | Size / line-height | Weight comes from | Where |
|---|---|---|---|
| `text-display` | 28/32, -0.8 tracking | `font-fraunces` | screen hero, wordmark |
| `text-title` | 21/26, -0.4 tracking | `font-fraunces` | detail page name |
| `text-section` | 17/22 | `font-fraunces` | section headers |
| `text-body` | 14/20 | `font-dm` | descriptions |
| `text-body-strong` | 14/20 | `font-dm-medium`/`-bold` | card titles, buttons |
| `text-label` | 12.5/16 | `font-dm-medium` | chips, list rows |
| `text-meta` | 11.5/15 | `font-dm` | distance, hours, price |
| `text-micro` | 9.5/12, +0.6 tracking | `font-dm-bold` | eyebrows, badges (+ `uppercase`) |

Existing screens still use `text-[12px]` etc. — unchanged, safe, but new code
should use the scale. Migrating a screen: map old size to nearest step
(12/12.5 → `label`; 13/13.5/14 → `body`/`body-strong`; 8.5–11.5 → `meta` or
`micro` depending on weight/case) and spot-check the diff, don't blind
find-replace.

## Radius scale

`rounded-control` (12px, buttons/inputs/small thumbnails), `rounded-card` (18px,
poster/venue/list cards and peek rows), `rounded-panel` (22px, option cards,
ribbons, the stay anchor), `rounded-sheet` (25px, the Vee hero, bottom sheets,
modals). `rounded-full` for pills — that's Tailwind's built-in, not part of this
scale. A lint rule rejects new `rounded-[Npx]` values.

## The signature: walk time

Principle 2 (walkability is the primary sort, not a filter) has no fixed
visual home today. Every card/row/detail header should carry a walk-time
marker in the same slot, same `text-meta` tabular-number treatment, colored
`open` under 5 minutes and `fg-muted` beyond — so the guest learns to scan
one column down the screen instead of re-reading each card. This is the one
bold, repeated element; everything else (warm `warm`/`warm-strong` accents,
live-now dot) stays scarce so it still reads as meaningful when it appears.

## What's not done yet

- The ~440 call sites still using `text-[Npx]` arbitrary sizes
- Shadow tokens are wired (`useElevation`), but older screens still hand-roll
  `shadow-2xs`/`shadow-sm`
- `Glyph` (real Tabler package, `src/components/glyph.tsx`) is used by the
  redesigned surfaces; the rest of the app still draws from the hand-copied
  `ICON_PATHS`. New glyphs belong in `Glyph`.
- New primitives: `SecondaryButton`, `Badge`, `ListRow`, `EmptyState`, `Sheet`,
  `Price`/`Distance`/`TimeRange` formatters
- A lint rule banning raw hex in `src/app`

Each is a separate, screen-by-screen pass — do not batch them into one diff.
