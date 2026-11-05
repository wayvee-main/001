import { RESTAURANTS } from '@/lib/data';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';

/** Discover's taxonomy: four families, each split into specific categories read
 * from what every record already says about itself (cuisine, kind, venue
 * description). Nothing is inferred beyond those words, and a category with no
 * entries is never shown. */

export type DiscoverFamilyId = 'eat' | 'go-out' | 'drink' | 'wander';
export type DiscoverCategory = {
  id: string; family: DiscoverFamilyId; title: string; glyph: string;
  /** Singular / plural noun for counts ("3 walks"). */
  unit: readonly [string, string];
  entries: HomeGuideEntry[];
  /** Optional second line per entry, e.g. verified late hours. */
  meta?: Record<string, string>;
};
export type DiscoverSeries = { id: string; title: string; venue: HomeGuideEntry; time: string; weekday: string; href: string };
export type DiscoverFamily = { id: DiscoverFamilyId; title: string; unit: readonly [string, string]; categories: DiscoverCategory[]; count: number };
export type DiscoverGuide = {
  families: DiscoverFamily[];
  /** Cross-cutting shortcuts shown first (Open late, Happy hours, …). */
  shortcuts: DiscoverCategory[];
  /** Every non-empty category, families first, then cross-cuts. */
  all: DiscoverCategory[];
  byId: Record<string, DiscoverCategory>;
  /** Weekly series published on a venue's own facts (e.g. "Blue Mondays"). */
  series: DiscoverSeries[];
};

type Rule = { id: string; title: string; glyph: string; unit?: readonly [string, string]; test: (entry: HomeGuideEntry, text: string) => boolean };
const PLACES = ['place', 'places'] as const;
const text = (entry: HomeGuideEntry) => entry.caption.toLowerCase();
const has = (pattern: RegExp) => (_: HomeGuideEntry, value: string) => pattern.test(value);

const EAT: Rule[] = [
  { id: 'coffee', title: 'Coffee & bakeries', glyph: 'coffee', test: (entry, value) => entry.category === 'cafe' || /coffee|bakery|donut/.test(value) },
  { id: 'pizza', title: 'Pizza', glyph: 'pizza', test: has(/pizza/) },
  { id: 'italian', title: 'Italian', glyph: 'wine', test: has(/italian/) },
  { id: 'japanese', title: 'Ramen & Japanese', glyph: 'bowl', test: has(/ramen|japanese|sushi/) },
  { id: 'chinese-korean', title: 'Chinese & Korean', glyph: 'bowl', test: has(/chinese|korean|hong kong|pan-asian/) },
  { id: 'southeast-asian', title: 'Southeast Asian', glyph: 'leaf', test: has(/thai|vietnamese|\blao\b|cambodian|burmese|filipino/) },
  { id: 'latin', title: 'Mexican & Latin', glyph: 'flame', test: has(/mexican|latin|oaxacan|salvadoran|dominican|peruvian|colombian|guerrerense/) },
  { id: 'soul', title: 'Soul & Southern', glyph: 'heart', test: has(/soul|southern|creole|barbecue|\bbbq\b|chicken/) },
  { id: 'quick', title: 'Burgers, sandwiches & quick bites', glyph: 'burger', test: has(/burger|sandwich|salad|diner|\bdeli\b/) },
  { id: 'seafood', title: 'Seafood & raw bar', glyph: 'fish', test: (entry, value) => /oyster|seafood|raw bar/.test(value) || /raw bar/i.test(entry.detailContent?.description || '') },
  { id: 'californian', title: 'Californian & New American', glyph: 'spark', test: has(/californian|california|new american|american brasserie|supper club/) },
  { id: 'more-eat', title: 'More to try', glyph: 'compass', test: () => true },
];
const DRINK: Rule[] = [
  { id: 'cocktail-bars', title: 'Cocktail bars', glyph: 'drink', unit: ['bar', 'bars'], test: has(/cocktail/) },
  { id: 'music-dancing', title: 'Music & dancing', glyph: 'music', unit: ['bar', 'bars'], test: has(/\bdj\b|club|live music|listening/) },
  { id: 'beer', title: 'Beer & beer gardens', glyph: 'beer', unit: ['bar', 'bars'], test: has(/beer|taproom|brew/) },
  { id: 'sports-bars', title: 'Sports bars', glyph: 'ball', unit: ['bar', 'bars'], test: has(/sports/) },
  { id: 'more-bars', title: 'Neighborhood bars', glyph: 'drink', unit: ['bar', 'bars'], test: () => true },
];
const ROOMS: Rule[] = [
  { id: 'music-rooms', title: 'Music rooms', glyph: 'music', unit: ['room', 'rooms'], test: has(/music|blues|jazz/) },
  { id: 'theaters', title: 'Theaters & landmarks', glyph: 'landmark', unit: ['venue', 'venues'], test: has(/theat|palace|landmark|cinema|opera/) },
  { id: 'more-rooms', title: 'More rooms', glyph: 'landmark', unit: ['venue', 'venues'], test: () => true },
];
const BAR_CATEGORIES = new Set(['bar', 'pub', 'nightclub', 'biergarten']);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function sortInto(rules: Rule[], family: DiscoverFamilyId, entries: HomeGuideEntry[]): DiscoverCategory[] {
  const buckets = rules.map(rule => ({ id: rule.id, family, title: rule.title, glyph: rule.glyph, unit: rule.unit || PLACES, entries: [] as HomeGuideEntry[] }));
  for (const entry of entries) {
    const index = rules.findIndex(rule => rule.test(entry, text(entry)));
    if (index >= 0) buckets[index].entries.push(entry);
  }
  return buckets.filter(bucket => bucket.entries.length);
}

/** Restaurants and map places describe the same venue twice; keep the first
 * (curated) record so a place is never counted or listed twice. */
function unique(entries: HomeGuideEntry[]): HomeGuideEntry[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = entry.name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

const detailsText = (entry: HomeGuideEntry) => entry.details.map(detail => `${detail.label} ${detail.value}`).join(' · ');
export const hasHappyHour = (entry: HomeGuideEntry) => /happy[ -]?hour/i.test(detailsText(entry))
  || (entry.detailContent?.offers || []).some(offer => /happy[ -]?hour/i.test(`${offer.label} ${offer.description}`));

/** Weekly series a venue publishes as its own fact, e.g. "Blue Mondays: 7–11 PM". */
export function weeklySeries(entries: HomeGuideEntry[]): DiscoverSeries[] {
  return entries.filter(entry => entry.kind === 'venue').flatMap(venue => venue.details.flatMap(detail => {
    const weekday = WEEKDAYS.find(day => new RegExp(`\\b${day}s\\b`, 'i').test(detail.label));
    const time = detail.value.split(' · ').find(part => /\d/.test(part) && /(am|pm)/i.test(part));
    return weekday && time ? [{ id: `${venue.id}:${detail.label}`, title: detail.label, venue, time, weekday, href: homeGuideHref(venue) }] : [];
  }));
}

export function buildDiscoverGuide(catalog: HomeGuideCatalog): DiscoverGuide {
  const all = unique(Object.values(catalog.entries).filter(entry => entry.kind !== 'collection'));
  const food = all.filter(entry => entry.kind === 'restaurant' || entry.kind === 'place' && !BAR_CATEGORIES.has(entry.category || ''));
  const bars = all.filter(entry => entry.kind === 'night' || entry.kind === 'place' && BAR_CATEGORIES.has(entry.category || ''));
  const venues = all.filter(entry => entry.kind === 'venue');
  const events = all.filter(entry => entry.kind === 'event').sort((a, b) => Date.parse(a.startsAt || '') - Date.parse(b.startsAt || ''));
  const series = weeklySeries(venues);

  const shows: DiscoverCategory = { id: 'shows', family: 'go-out', title: 'On stage', glyph: 'ticket', unit: ['show', 'shows'], entries: events };
  const families: DiscoverFamily[] = [
    { id: 'eat', title: 'Eat', unit: PLACES, categories: sortInto(EAT, 'eat', food), count: food.length },
    { id: 'go-out', title: 'Go out', unit: ['show or room', 'shows & rooms'], categories: [shows, ...sortInto(ROOMS, 'go-out', venues)].filter(category => category.entries.length), count: events.length + venues.length },
    { id: 'drink', title: 'Drink', unit: ['bar', 'bars'], categories: sortInto(DRINK, 'drink', bars), count: bars.length },
    { id: 'wander', title: 'Wander', unit: ['route or walk', 'routes & walks'], count: 0, categories: ([
      { id: 'lakes-trails', family: 'wander', title: 'Lakes & trails', glyph: 'trees', unit: ['walk', 'walks'], entries: all.filter(entry => entry.kind === 'outdoor') },
      { id: 'bar-crawls', family: 'wander', title: 'Bar crawls', glyph: 'route', unit: ['route', 'routes'], entries: all.filter(entry => entry.kind === 'crawl') },
      { id: 'experiences', family: 'wander', title: 'Tours & experiences', glyph: 'compass', unit: ['experience', 'experiences'], entries: all.filter(entry => entry.kind === 'pick') },
    ] satisfies DiscoverCategory[]).filter(category => category.entries.length) },
  ];
  families[3].count = families[3].categories.reduce((sum, category) => sum + category.entries.length, 0);

  const late = food.filter(entry => entry.kind === 'restaurant' && RESTAURANTS[entry.id]?.openLate);
  const lateHours = Object.fromEntries(late.flatMap(entry => { const hours = RESTAURANTS[entry.id]?.hoursShort || ''; return hours && !/confirm/i.test(hours) ? [[entry.id, hours]] : []; }));
  const shortcuts: DiscoverCategory[] = ([
    { id: 'open-late', family: 'eat', title: 'Open late', glyph: 'moon', unit: PLACES, entries: [...late.filter(entry => lateHours[entry.id]), ...late.filter(entry => !lateHours[entry.id])], meta: lateHours },
    { id: 'happy-hours', family: 'eat', title: 'Happy hours', glyph: 'tag', unit: PLACES, entries: all.filter(hasHappyHour) },
    { id: 'budget', family: 'eat', title: 'Budget-friendly', glyph: 'wallet', unit: PLACES, entries: food.filter(entry => entry.facts.some(fact => fact.glyph === 'wallet' && fact.value.trim() === '$')) },
    { id: 'live-music', family: 'go-out', title: 'Live music & DJs', glyph: 'music', unit: PLACES, entries: [...venues, ...bars].filter(entry => /music|\bdj\b|blues|jazz|listening/.test(text(entry))) },
  ] satisfies DiscoverCategory[]).filter(category => category.entries.length);

  const everything = [...families.flatMap(family => family.categories), ...shortcuts];
  return { families, shortcuts, all: everything, byId: Object.fromEntries([...everything, ...families.map((family): DiscoverCategory => ({ id: family.id, family: family.id, title: family.title, glyph: 'compass', unit: family.unit, entries: family.categories.flatMap(category => category.entries) }))].map(category => [category.id, category])), series };
}

export const countLabel = (count: number, unit: readonly [string, string]) => `${count} ${count === 1 ? unit[0] : unit[1]}`;
