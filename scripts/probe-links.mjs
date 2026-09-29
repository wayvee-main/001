import fs from 'node:fs';
import process from 'node:process';
import ts from 'typescript';

function loadPlain(path) {
  const source = fs.readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', output)(mod, mod.exports, () => {
    throw new Error(`${path} must stay dependency-free for link probes.`);
  });
  return mod.exports;
}

// data.ts's only import — events.ts is itself dependency-free (see its own
// header), so this is the one relative require the stub above needs to
// resolve rather than reject outright.
const events = loadPlain('src/lib/events.ts');

const dataSource = fs.readFileSync('src/lib/data.ts', 'utf8');
const dataOutput = ts.transpileModule(dataSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', 'require', dataOutput)(module, module.exports, (spec) => {
  if (spec === './events') return events;
  throw new Error(`src/lib/data.ts: unexpected import '${spec}' — link probe only resolves ./events.`);
});
const data = module.exports;

const linksSource = fs.readFileSync('src/lib/links.ts', 'utf8');
const linksOutput = ts.transpileModule(linksSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const linksModule = { exports: {} };
new Function('module', 'exports', linksOutput)(linksModule, linksModule.exports);
const links = linksModule.exports;

const urls = new Set();
const add = (value) => {
  if (typeof value === 'string' && /^https:\/\//.test(value)) urls.add(value);
};

for (const restaurant of Object.values(data.RESTAURANTS)) {
  [restaurant.sourceUrl, restaurant.menuUrl, restaurant.primaryAction.url, restaurant.orderUrl, restaurant.reserveUrl]
    .forEach(add);
  restaurant.delivery?.forEach((quote) => add(quote.url));
}
for (const event of data.currentEventListings(new Date('2026-07-19T19:00:00Z'))) {
  [event.sourceUrl, event.ticketUrl].forEach(add);
}
for (const venue of Object.values(data.VENUES)) add(venue.sourceUrl);
for (const crawl of Object.values(data.CRAWLS)) add(crawl.routeUrl);
for (const item of data.NIGHTLIFE_SPOTS) add(item.url);
for (const url of Object.values(links.PROMOTION_LINKS)) add(url);

const queue = [...urls];
const failures = [];
let checked = 0;

async function worker() {
  while (queue.length) {
    const url = queue.shift();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'Wayvee release link checker' },
      });
      await response.body?.cancel();
      const hostname = new URL(url).hostname;
      const knownProviderBotGate = response.status === 406 && (hostname === 'uber.com' || hostname.endsWith('.uber.com'));
      const acceptable = (response.status >= 200 && response.status < 400)
        || [401, 403, 405, 429].includes(response.status)
        || knownProviderBotGate;
      if (!acceptable) failures.push(`${response.status} ${url}`);
    } catch (error) {
      failures.push(`${error instanceof Error ? error.name : 'NetworkError'} ${url}`);
    } finally {
      clearTimeout(timer);
      checked += 1;
    }
  }
}

await Promise.all(Array.from({ length: 8 }, () => worker()));

if (failures.length) {
  console.error(`External link probe failed (${failures.length}/${checked}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`External link probe passed: ${checked} current action and source URLs responded.`);
