// Image liveness check: verifies every image URL in the catalog actually serves
// an image. Network-bound — run separately from audit:data (npm run audit:images).
import { EVENTS, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES } from '../src/lib/data';

interface Target {
  owner: string;
  url: string;
}

const targets: Target[] = [];
for (const r of Object.values(RESTAURANTS)) {
  targets.push({ owner: `restaurant ${r.id} image`, url: r.image });
  if (r.dishImage && r.dishImage !== r.image) targets.push({ owner: `restaurant ${r.id} dishImage`, url: r.dishImage });
  for (const item of r.menuHighlights) {
    if (item.image) targets.push({ owner: `restaurant ${r.id} menu "${item.name}"`, url: item.image });
  }
}
for (const v of Object.values(VENUES)) targets.push({ owner: `venue ${v.id}`, url: v.image });
for (const e of Object.values(EVENTS)) targets.push({ owner: `event ${e.id}`, url: e.image });
for (const s of NIGHTLIFE_SPOTS) {
  if (s.image) targets.push({ owner: `nightlife ${s.id}`, url: s.image });
}

const unique = new Map<string, string[]>();
for (const t of targets) {
  const owners = unique.get(t.url) ?? [];
  owners.push(t.owner);
  unique.set(t.url, owners);
}

async function check(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Wayvee-audit' },
    });
    clearTimeout(timer);
    if (!res.ok) return `HTTP ${res.status}`;
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return `not an image (${type.split(';')[0]})`;
    await res.body?.cancel();
    return null;
  } catch (error) {
    return `fetch failed (${error instanceof Error ? error.message.slice(0, 60) : 'unknown'})`;
  }
}

async function main() {
  const urls = [...unique.keys()];
  console.log(`checking ${urls.length} unique image URLs (${targets.length} references)…`);
  const failures: string[] = [];
  const batch = 12;
  for (let i = 0; i < urls.length; i += batch) {
    const results = await Promise.all(urls.slice(i, i + batch).map(async (url) => ({ url, error: await check(url) })));
    for (const { url, error } of results) {
      if (error) failures.push(`${error} — ${unique.get(url)?.join(', ')}\n    ${url}`);
    }
  }
  console.log(failures.length ? failures.join('\n') : 'ALL IMAGES OK');
  if (failures.length) {
    console.log(`\n${failures.length} broken of ${urls.length}`);
    process.exit(1);
  }
}

void main();
