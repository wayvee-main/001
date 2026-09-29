# Main screen screenshots

The four tab screens (`src/app/(tabs)/`), captured from the production web export.
Last captured **Aug 24, 2026** — the clock matters, because Home and Plans both
read the current daypart and drop events that have already happened.

| Screenshot | Tab | Route |
| --- | --- | --- |
| `01-cue-home.png` | Vee | `(tabs)/index` |
| `02-tonight-discover.png` | Tonight | `(tabs)/discover` |
| `03-plans.png` | Plans | `(tabs)/create` |
| `04-you-profile.png` | You | `(tabs)/profile` |

## How they were captured

```bash
npm run build:web           # production export → dist/
npx serve dist -l 8090      # any static server works
```

Then Chromium (Playwright) at an iPhone 16 Pro viewport — 402 × 874 logical,
`deviceScaleFactor: 3`, so the PNGs are 1206 × 2622 — navigating by clicking the
tab bar. Two things are seeded in `localStorage` before first paint:

- `wayvee.arrival.v1 = 'done'` — the arrival sequence gates the tab navigator
  (`src/lib/arrival.ts`), so without it the capture never reaches a tab screen.
- `wayvee.trip-context.v1 = 'visiting'` — the answer that sequence collects.

The export is used rather than the dev server because Metro's dev-time error
toast (`#error-toast`) overlays the tab bar and swallows tab clicks.

## What the shots show

A signed-out guest session on curated Oakland content (`src/lib/data.ts`), with
`Appearance` on `System` in a light-scheme browser. Every dated line comes from
the fixtures in `src/lib/events.ts`, filtered against the capture time — the
same frames re-shot on a different evening name different shows.

Photos render as the striped placeholder from `src/components/photo.tsx`: the
capture ran in a sandbox whose network policy blocks the remote image hosts and
Supabase, so every remote image failed and `Photo` kept its placeholder. That is
the app's real offline behavior, not a rendering bug — on a network that can
reach those hosts, the same frames fill in with photography.
