// Universal cross-search: one index over every real, browsable thing in the
// app (restaurants, individual dishes, places, events, venues, nightlife
// spots, crawls, Viator picks, collections) so any search bar in the app can
// share the same matching quality instead of nine separate ad hoc filters.
//
// Two-phase by design: buildSearchIndex() assembles candidates from current
// data (cheap to memoize — it only changes when places/picks hydrate),
// queryIndex() scores those candidates against a query (cheap enough to run
// on every keystroke). Keeping them separate means typing doesn't re-walk
// ~1,000 records per character.
import {
  CRAWLS,
  CURATED_COLLECTIONS,
  EVENTS,
  FOOD_HUB_REASON_BY_ID,
  NIGHTLIFE_SPOTS,
  RESTAURANTS,
  VENUES,
  isCurrentEvent,
} from '@/lib/data';
import { placeCategoryLabel, placeMetaLine, type Place } from '@/lib/places';
import { affinityScore } from '@/lib/taste';
import type { ViatorPick } from '@/lib/viator';

export type SearchResultKind = 'restaurant' | 'dish' | 'place' | 'event' | 'venue' | 'night' | 'crawl' | 'pick' | 'collection';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  href: string;
  score: number;
}

interface SearchCandidate {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  image?: string;
  href: string;
  fields: { text: string; weight: number }[];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, ' ')
    .trim();
}

/** Bounded Levenshtein — same shape as the one already trusted for dish search
 * in lib/data.ts, generalized here so typo tolerance covers every kind. */
function editDistanceAtMost(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return false;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length] <= max;
}

/** Real-world category synonyms, not fabricated attributes — a café serves
 * coffee by definition, so "coffee" should find it even though the stored
 * category label is "Café". Kept to genuinely synonymous terms only. */
export const CATEGORY_SYNONYMS: Record<string, string> = {
  cafe: 'coffee cafe',
  brewery: 'beer brewery',
  wine_bar: 'wine',
  pub: 'beer pub',
  bakery: 'bread pastry baked goods',
  night_club: 'club nightlife dancing',
  bar: 'drinks cocktails',
};

/** AND across tokens (every token must land somewhere) with per-field weights,
 * substring/prefix boosts, and a small typo-tolerant fallback for longer
 * tokens. Returns null when any token fails to match anywhere. */
function scoreFields(fields: { text: string; weight: number }[], tokens: string[]): number | null {
  const normFields = fields
    .map((f) => ({ norm: normalize(f.text), weight: f.weight }))
    .filter((f) => f.norm.length > 0);

  let total = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    for (const f of normFields) {
      if (f.norm.includes(token)) {
        tokenScore = Math.max(tokenScore, f.weight);
        continue;
      }
      const words = f.norm.split(' ');
      if (token.length >= 3 && words.some((w) => w.startsWith(token))) {
        tokenScore = Math.max(tokenScore, f.weight * 0.7);
        continue;
      }
      if (token.length >= 4) {
        const budget = token.length >= 7 ? 2 : 1;
        if (words.some((w) => w.length >= 3 && editDistanceAtMost(token, w, budget))) {
          tokenScore = Math.max(tokenScore, f.weight * 0.35);
        }
      }
    }
    if (!tokenScore) return null;
    total += tokenScore;
  }
  return total;
}

function restaurantFields(r: (typeof RESTAURANTS)[string]): { text: string; weight: number }[] {
  return [
    { text: r.name, weight: 10 },
    { text: r.cuisine, weight: 6 },
    { text: (r.searchTags ?? []).join(' '), weight: 5 },
    { text: FOOD_HUB_REASON_BY_ID[r.id] ?? '', weight: 3 },
    { text: r.address, weight: 2 },
    { text: r.popularDishes.map((d) => d.name).join(' '), weight: 3 },
  ];
}

function placeFields(p: Place): { text: string; weight: number }[] {
  return [
    { text: p.name, weight: 10 },
    { text: p.cuisine ?? '', weight: 6 },
    { text: placeCategoryLabel(p), weight: 4 },
    { text: CATEGORY_SYNONYMS[p.category] ?? '', weight: 4 },
    { text: p.address ?? '', weight: 2 },
  ];
}

/** Assembles every indexable candidate once. Memoize on [allPlaces, allPicks]
 * in the caller — this is the expensive-ish half, not the per-keystroke half. */
export function buildSearchIndex(allPlaces: Place[], allPicks: ViatorPick[]): SearchCandidate[] {
  const list: SearchCandidate[] = [];

  for (const r of Object.values(RESTAURANTS)) {
    list.push({
      kind: 'restaurant',
      id: r.id,
      title: r.name,
      subtitle: `${r.cuisine} · ${r.price} · ${r.distanceLabel}`,
      image: r.image,
      href: `/restaurant/${r.id}`,
      fields: restaurantFields(r),
    });
    for (const item of r.menuHighlights) {
      list.push({
        kind: 'dish',
        id: `${r.id}:${item.name}`,
        title: item.name,
        subtitle: `at ${r.name}`,
        image: r.image,
        href: `/restaurant/${r.id}`,
        fields: [
          { text: item.name, weight: 10 },
          { text: item.desc ?? '', weight: 4 },
          { text: item.categories.join(' '), weight: 3 },
          { text: r.name, weight: 2 },
        ],
      });
    }
  }

  for (const p of allPlaces) {
    list.push({
      kind: 'place',
      id: p.id,
      title: p.name,
      subtitle: placeMetaLine(p),
      image: p.image ?? undefined,
      href: `/place/${p.id}`,
      fields: placeFields(p),
    });
  }

  for (const e of Object.values(EVENTS)) {
    if (!isCurrentEvent(e)) continue;
    list.push({
      kind: 'event',
      id: e.id,
      title: e.name,
      subtitle: `${e.date.split(' · ')[0]} · ${e.venue}`,
      image: e.image,
      href: `/event/${e.id}`,
      fields: [
        { text: e.name, weight: 10 },
        { text: e.venue, weight: 5 },
        { text: e.lineup, weight: 4 },
        { text: (e.vibeTags ?? []).join(' '), weight: 4 },
        { text: e.cats.join(' '), weight: 3 },
      ],
    });
  }

  for (const v of Object.values(VENUES)) {
    list.push({
      kind: 'venue',
      id: v.id,
      title: v.name,
      subtitle: v.sub1,
      image: v.image,
      href: `/venue/${v.id}`,
      fields: [
        { text: v.name, weight: 10 },
        { text: v.sub1, weight: 3 },
        { text: v.sub2, weight: 2 },
      ],
    });
  }

  for (const spot of NIGHTLIFE_SPOTS) {
    list.push({
      kind: 'night',
      id: spot.id,
      title: spot.name,
      subtitle: spot.kind,
      image: spot.image,
      href: `/night/${spot.id}`,
      fields: [
        { text: spot.name, weight: 10 },
        { text: spot.kind, weight: 5 },
        { text: spot.address, weight: 2 },
      ],
    });
  }

  for (const c of Object.values(CRAWLS)) {
    list.push({
      kind: 'crawl',
      id: c.id,
      title: c.name,
      subtitle: c.meta,
      href: `/crawl/${c.id}`,
      fields: [
        { text: c.name, weight: 10 },
        { text: c.meta, weight: 3 },
        { text: c.stops.map((s) => s.name).join(' '), weight: 4 },
      ],
    });
  }

  for (const pick of allPicks) {
    list.push({
      kind: 'pick',
      id: pick.id,
      title: pick.title,
      subtitle: pick.destination,
      image: pick.image,
      href: `/pick/${pick.id}`,
      fields: [
        { text: pick.title, weight: 10 },
        { text: pick.destination, weight: 4 },
        { text: pick.description, weight: 2 },
      ],
    });
  }

  for (const col of Object.values(CURATED_COLLECTIONS)) {
    list.push({
      kind: 'collection',
      id: col.id,
      title: col.title,
      subtitle: col.subtitle,
      image: col.coverImage,
      href: `/collection/${col.id}`,
      fields: [
        { text: col.title, weight: 8 },
        { text: col.shortTitle, weight: 5 },
        { text: col.description, weight: 2 },
      ],
    });
  }

  return list;
}

/** Scores a prebuilt index against a query. Cheap — safe to call every keystroke.
 * tasteTags (from the guest's taste profile) add a small relevance bonus when
 * they overlap a candidate's own fields — a tiebreak among real text matches,
 * never a way for an unrelated result to outrank one that actually matches. */
export function queryIndex(candidates: SearchCandidate[], query: string, tasteTags: string[] = []): SearchResult[] {
  const normQuery = normalize(query);
  const tokens = normQuery.split(' ').filter(Boolean);
  if (!tokens.length) return [];

  const results: SearchResult[] = [];
  for (const c of candidates) {
    const fieldScore = scoreFields(c.fields, tokens);
    if (fieldScore == null) continue;
    const normTitle = normalize(c.title);
    let bonus = 0;
    if (normTitle === normQuery) bonus = 40;
    else if (normTitle.startsWith(normQuery)) bonus = 18;
    if (tasteTags.length) bonus += affinityScore(tasteTags, c.fields.map((f) => f.text).join(' ')) * 5;
    results.push({ kind: c.kind, id: c.id, title: c.title, subtitle: c.subtitle, image: c.image, href: c.href, score: fieldScore + bonus });
  }
  return results.sort((a, b) => b.score - a.score);
}

export interface Suggestion {
  /** What's shown and tapped, e.g. "Mexican near me" or "Mezcal". */
  label: string;
  /** What actually gets searched when tapped, e.g. "Mexican" or "Mezcal". */
  query: string;
}

interface VocabWord {
  word: string;
  kind: 'cuisine' | 'word';
}

/** Real words pulled straight from the data — no invented phrases. Cuisine
 * words alone read oddly as a tap target ("Mexican"?), so they get a
 * " near me" suffix; everything else (tags, dish names, event/venue names)
 * is specific enough to stand on its own. */
export function buildVocabulary(allPlaces: Place[]): VocabWord[] {
  const cuisines = new Set<string>();
  const words = new Set<string>();

  for (const r of Object.values(RESTAURANTS)) {
    if (r.cuisine) cuisines.add(r.cuisine);
    for (const tag of r.searchTags ?? []) words.add(tag);
  }
  for (const p of allPlaces) {
    if (p.cuisine) cuisines.add(p.cuisine);
  }
  for (const e of Object.values(EVENTS)) {
    if (!isCurrentEvent(e)) continue;
    for (const tag of e.vibeTags ?? []) words.add(tag);
  }
  for (const spot of NIGHTLIFE_SPOTS) words.add(spot.kind);

  return [
    ...[...cuisines].filter(Boolean).map((word) => ({ word, kind: 'cuisine' as const })),
    ...[...words].filter(Boolean).map((word) => ({ word, kind: 'word' as const })),
  ];
}

export function suggestFor(prefix: string, vocabulary: VocabWord[], limit = 8): Suggestion[] {
  const norm = normalize(prefix);
  if (!norm) return [];

  const matches = vocabulary
    .filter((v) => normalize(v.word).includes(norm))
    .sort((a, b) => {
      const aPrefix = normalize(a.word).startsWith(norm) ? 0 : 1;
      const bPrefix = normalize(b.word).startsWith(norm) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.word.length - b.word.length;
    });

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const m of matches) {
    const key = m.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: m.kind === 'cuisine' ? `${m.word} near me` : m.word, query: m.word });
    if (out.length >= limit) break;
  }
  return out;
}

export const SEARCH_KIND_LABELS: Record<SearchResultKind, string> = {
  restaurant: 'Restaurants',
  dish: 'Dishes',
  place: 'Places',
  event: 'Shows & events',
  venue: 'Venues',
  night: 'Nightlife',
  crawl: 'Routes',
  pick: 'Experiences',
  collection: 'Collections',
};
