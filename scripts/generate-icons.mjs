/**
 * Regenerates every raster brand asset from the Wayvee mark.
 *
 * The mark itself lives in src/components/vee-mark.tsx — that is the source of
 * truth for the app. This file re-states its geometry because the icons are
 * rasterised by a browser, not by React Native, so the two have to be kept in
 * step by hand when the drawing changes. Run `npm run icons` after any change
 * to the mark, and commit the PNGs.
 *
 * Rendering uses whatever Chromium is on the machine, driven headless. Set
 * CHROME_PATH if it lives somewhere unusual.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

const ROOT = resolve(import.meta.dirname, '..');
const WORK = mkdtempSync(join(tmpdir(), 'wayvee-icons-'));

// Chromium clamps a headless window to roughly 150px, and shaves rows when the
// window matches the page exactly. So each tile is rendered at a whole multiple
// of its target, anchored top-left inside a roomier window, then cropped and
// boxed down. MARGIN only has to exceed whatever it shaves.
const MIN_RENDER = 160;
const MARGIN = 240;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chrome) {
  console.error(`No Chromium found. Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}\nSet CHROME_PATH.`);
  process.exit(1);
}

const CORAL = '#E45526';
const CREAM = '#FFFDFA';
const INK = '#2A1B33';
const PEACH = '#FFF1ED';

const GRADIENT = `<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
<stop offset="0" stop-color="#FFC757"/><stop offset="0.35" stop-color="#E85D2C"/>
<stop offset="0.72" stop-color="#6F5BD1"/><stop offset="1" stop-color="#FFC757"/>
</linearGradient></defs>`;

/** The full fork. Mirrors VeeMark's `primary`. */
const primary = (paint, sw = 2.3) => `
<path d="M20 34 V 23" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round"/>
<path d="M20 23 C 20 16, 15.9 14.5, 12.4 14.5" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
<path d="M20 23 C 20 16, 25.5 14.5, 29.5 14.5" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
<circle cx="8.4" cy="14.5" r="3.2" stroke="${paint}" stroke-width="${sw}" fill="none"/>
<circle cx="31" cy="14.5" r="3.5" fill="${paint}"/>`;

/** Straight branches and one heavy terminal — drawn for the favicon's 16px,
 * where the curves and the open ring of the full fork silt up. */
const compact = (paint, sw = 4.2) => `
<path d="M20 36 V 27" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round"/>
<path d="M20 27 L 10 17" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round"/>
<path d="M20 27 L 29.5 17.5" stroke="${paint}" stroke-width="${sw}" stroke-linecap="round"/>
<circle cx="31" cy="15" r="5" fill="${paint}"/>`;

// `ratio` is the mark box over the tile. The app icon and favicon match the
// approved artwork sheet; android adaptive keeps the mark inside the central
// 61% a launcher mask may crop to, and maskable inside the inner 80%.
const ICONS = [
  ['assets/images/icon.png', 1024, CORAL, primary(CREAM), 0.62],
  ['assets/images/favicon.png', 64, CORAL, compact(CREAM), 0.68],
  ['assets/images/splash-icon.png', 280, null, primary('url(#g)'), 1],
  ['assets/images/android-icon-foreground.png', 1024, null, primary(CORAL), 0.45],
  ['assets/images/android-icon-background.png', 1024, PEACH, '', 0],
  ['assets/images/android-icon-monochrome.png', 1024, null, primary(INK), 0.45],
  ['public/wayvee-192.png', 192, CORAL, primary(CREAM), 0.62],
  ['public/wayvee-512.png', 512, CORAL, primary(CREAM), 0.62],
  ['public/wayvee-maskable-512.png', 512, CORAL, primary(CREAM), 0.42],
  ['public/apple-touch-icon.png', 180, CORAL, primary(CREAM), 0.62],
];

function documentFor(render, ground, body, ratio) {
  const px = Math.round(render * ratio);
  const defs = body.includes('url(#g)') ? GRADIENT : '';
  const svg = body ? `<svg width="${px}" height="${px}" viewBox="0 0 40 40" fill="none">${defs}${body}</svg>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent}
#tile{position:absolute;top:0;left:0;width:${render}px;height:${render}px;
background:${ground ?? 'transparent'};display:flex;align-items:center;justify-content:center}
</style></head><body><div id="tile">${svg}</div></body></html>`;
}

/** Crop the tile out of the roomier canvas and box-filter it down. Alpha is
 * weighted so fully transparent pixels cannot drag colour out of the edges of
 * the marks drawn on no ground. */
function cropAndScale(source, size, scale) {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const i = ((y * scale + dy) * source.width + (x * scale + dx)) << 2;
          const alpha = source.data[i + 3];
          r += source.data[i] * alpha;
          g += source.data[i + 1] * alpha;
          b += source.data[i + 2] * alpha;
          a += alpha;
        }
      }
      const o = (y * size + x) << 2;
      out.data[o] = a ? Math.round(r / a) : 0;
      out.data[o + 1] = a ? Math.round(g / a) : 0;
      out.data[o + 2] = a ? Math.round(b / a) : 0;
      out.data[o + 3] = Math.round(a / (scale * scale));
    }
  }
  return out;
}

for (const [rel, size, ground, body, ratio] of ICONS) {
  let scale = 1;
  while (size * scale < MIN_RENDER) scale += 1;
  const render = size * scale;

  const slug = rel.replaceAll('/', '_');
  const page = join(WORK, `${slug}.html`);
  const shot = join(WORK, `${slug}.png`);
  writeFileSync(page, documentFor(render, ground, body, ratio));
  execFileSync(chrome, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--default-background-color=00000000',
    `--window-size=${render + MARGIN},${render + MARGIN}`,
    `--screenshot=${shot}`, pathToFileURL(page).href,
  ], { stdio: 'ignore' });

  const source = PNG.sync.read(readFileSync(shot));
  if (source.width < render || source.height < render) {
    console.error(`${rel}: Chromium returned ${source.width}x${source.height}, need ${render}.`);
    process.exit(1);
  }
  writeFileSync(join(ROOT, rel), PNG.sync.write(cropAndScale(source, size, scale)));
  console.log(`  ${String(size).padStart(4)}px  ${rel}`);
}

console.log(`${ICONS.length} icons written.`);
