// Data audit for the daily refresh workflow (see DATA.md).
// Run with: npm run audit:data — exits non-zero when the catalog has gaps.
import {
  CUISINE_MATCH,
  CURATED_COLLECTIONS,
  DEFAULT_FAVS,
  EVENTS,
  FOOD_HUB_SECTIONS,
  NIGHTLIFE_SPOTS,
  RESTAURANTS,
  VENUES,
  currentEventListings,
  isCurrentEvent,
} from '../src/lib/data';

const NOW = new Date();
const issues: string[] = [];
const warn = (msg: string) => issues.push(msg);

const restaurants = Object.values(RESTAURANTS);
const venues = Object.values(VENUES);
const events = Object.values(EVENTS);

// ── Restaurants + menus ──
let itemCount = 0;
let nativeImageCount = 0;
for (const r of restaurants) {
  for (const key of ['name', 'cuisine', 'price', 'distanceLabel', 'image', 'dishImage', 'readyEstimate', 'address', 'sourceUrl', 'menuUrl'] as const) {
    if (!r[key]) warn(`restaurant ${r.id}: missing ${key}`);
  }
  if (!r.primaryAction?.url) warn(`restaurant ${r.id}: missing primaryAction.url`);
  if (!r.detailFacts?.length) warn(`restaurant ${r.id}: empty detailFacts`);
  if (r.detailFacts.some((f) => !f.label || !f.value)) warn(`restaurant ${r.id}: blank detail fact`);
  if (!r.popularDishes?.length) warn(`restaurant ${r.id}: empty popularDishes`);
  if (!r.menuHighlights.length) warn(`restaurant ${r.id}: EMPTY menu`);
  else if (r.menuHighlights.length < 3) warn(`restaurant ${r.id}: thin menu (${r.menuHighlights.length} items)`);
  for (const item of r.menuHighlights) {
    itemCount += 1;
    if (item.image) nativeImageCount += 1;
    if (!item.name) warn(`restaurant ${r.id}: menu item without name`);
    if (!item.categories?.length) warn(`restaurant ${r.id}: menu item "${item.name}" has no categories`);
    if (item.image && !/^https:\/\//.test(item.image)) warn(`restaurant ${r.id}: menu image not https for "${item.name}"`);
  }
  const cats = new Set(r.menuHighlights.flatMap((i) => i.categories));
  if (r.menuHighlights.length >= 3 && cats.size < 2) warn(`restaurant ${r.id}: menu categories not varied`);
  if (!r.hours && !r.hoursShort) warn(`restaurant ${r.id}: no hours info at all`);
}

// ── Venues ──
const currentByVenue = new Map<string, number>();
for (const e of currentEventListings(NOW)) {
  if (e.venueId) currentByVenue.set(e.venueId, (currentByVenue.get(e.venueId) ?? 0) + 1);
}
for (const v of venues) {
  for (const key of ['name', 'address', 'image', 'sourceUrl'] as const) {
    if (!v[key]) warn(`venue ${v.id}: missing ${key}`);
  }
  if (!v.detailFacts?.length) warn(`venue ${v.id}: empty detailFacts`);
  if (!v.detailMeta) warn(`venue ${v.id}: missing detailMeta`);
  if (!(currentByVenue.get(v.id) ?? 0)) warn(`venue ${v.id}: NO current events (Events tab empty)`);
}

// ── Events ──
for (const e of events) {
  for (const key of ['name', 'startsAt', 'time', 'priceLabel', 'date', 'venue', 'addr', 'image', 'sourceUrl', 'know', 'verifiedLabel'] as const) {
    if (!e[key]) warn(`event ${e.id}: missing ${key}`);
  }
  const start = e.startsAt ? new Date(e.startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) warn(`event ${e.id}: unparseable startsAt "${e.startsAt}"`);
  else if (!isCurrentEvent(e, NOW)) warn(`event ${e.id}: PAST (${e.startsAt}) — delete on refresh`);
  if (e.ticketed && !e.ticketUrl) warn(`event ${e.id}: ticketed but no ticketUrl`);
  if (e.venueId && !VENUES[e.venueId]) warn(`event ${e.id}: unknown venueId "${e.venueId}"`);
  if (!e.vibeTags?.length) warn(`event ${e.id}: no vibeTags`);
  if (!e.cats?.length) warn(`event ${e.id}: no cats`);
}

// ── Nightlife shelf ──
const nightIds = new Set<string>();
for (const spot of NIGHTLIFE_SPOTS) {
  if (nightIds.has(spot.id)) warn(`nightlife ${spot.id}: duplicate id`);
  nightIds.add(spot.id);
  for (const key of ['name', 'kind', 'hours', 'address', 'desc', 'url'] as const) {
    if (!spot[key]) warn(`nightlife ${spot.id}: missing ${key}`);
  }
  if (spot.url && !/^https:\/\//.test(spot.url)) warn(`nightlife ${spot.id}: url not https`);
  if (spot.image && !/^https:\/\//.test(spot.image)) warn(`nightlife ${spot.id}: image not https`);
}

// ── Cross-references ──
const restaurantIds = new Set(Object.keys(RESTAURANTS));
for (const section of FOOD_HUB_SECTIONS) {
  for (const pick of section.picks) {
    if (!restaurantIds.has(pick.id)) warn(`FOOD_HUB_SECTIONS ${section.id}: unknown pick "${pick.id}"`);
    if (!pick.reason) warn(`FOOD_HUB_SECTIONS ${section.id}: pick "${pick.id}" missing reason`);
  }
  if (section.picks.length < 3) warn(`FOOD_HUB_SECTIONS ${section.id}: only ${section.picks.length} picks`);
}
for (const id of DEFAULT_FAVS) {
  if (!restaurantIds.has(id)) warn(`DEFAULT_FAVS: unknown id "${id}"`);
}
for (const [cuisine, ids] of Object.entries(CUISINE_MATCH)) {
  for (const id of ids) {
    if (!restaurantIds.has(id)) warn(`CUISINE_MATCH ${cuisine}: unknown id "${id}"`);
  }
}
for (const collection of Object.values(CURATED_COLLECTIONS)) {
  for (const item of collection.items) {
    const known = item.type === 'restaurant' ? restaurantIds.has(item.id) : Boolean(EVENTS[item.id]);
    if (!known) warn(`collection ${collection.id}: unknown ${item.type} "${item.id}"`);
  }
  const alive = collection.items.filter((item) =>
    item.type === 'restaurant' ? restaurantIds.has(item.id) : Boolean(EVENTS[item.id]) && isCurrentEvent(EVENTS[item.id], NOW));
  if (!alive.length) warn(`collection ${collection.id}: renders EMPTY (all items past or unknown)`);
}

console.log(`${restaurants.length} restaurants · ${venues.length} venues · ${events.length} events (${currentEventListings(NOW).length} current)`);
console.log(`native menu photos: ${nativeImageCount}/${itemCount} items (rest show the neutral placeholder)`);
console.log(issues.length ? issues.sort().join('\n') : 'CLEAN — no issues found');
if (issues.length) process.exit(1);
