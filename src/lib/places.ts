// Runtime hydration for the bulk places database — populated by
// scripts/sync-places.ts (server-side only) from Overture Maps + OpenStreetMap.
// The client never talks to either source directly; it just reads this table.
//
// Built reactive from day one (useSyncExternalStore) instead of the plain
// mutable-object approach viator.ts started with — that pattern silently
// missed re-renders whenever hydration resolved after a screen had already
// mounted (see the Home/picks "only shows up after a couple of refreshes"
// bug this session), so there's no reason to repeat it here.
import { useCallback, useSyncExternalStore } from 'react';

import { activeCity, cityCacheKey, useActiveCity } from '@/lib/city';
import type { GeoPoint } from '@/lib/geo';
import { getStoredItem, setStoredItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export interface Place {
  id: string;
  name: string;
  category: string;
  cuisine: string | null;
  address: string | null;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  image: string | null;
  /** Verbatim OpenStreetMap opening_hours tag, or null when the source has
   * none. Read with lib/hours.ts — never displayed as a schedule the app
   * inferred, and never treated as "closed" when it can't be parsed. */
  openingHours: string | null;
  confidence: 'cross_confirmed' | 'overture_only' | 'osm_only';
  needsReview: boolean;
}

interface PlaceRow {
  id: string;
  name: string;
  category: string;
  cuisine: string | null;
  address: string | null;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  image: string | null;
  opening_hours: string | null;
  confidence: string;
  needs_review: boolean;
}

function rowToPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cuisine: row.cuisine,
    address: row.address,
    lat: row.lat,
    lon: row.lon,
    website: row.website,
    phone: row.phone,
    image: row.image,
    // A row synced before the opening_hours column existed simply has none.
    openingHours: row.opening_hours ?? null,
    confidence: row.confidence === 'cross_confirmed' || row.confidence === 'overture_only' || row.confidence === 'osm_only'
      ? row.confidence
      : 'osm_only',
    needsReview: row.needs_review,
  };
}

/** Human label for a place's category — same "known values only, unknown
 * stays unlabeled rather than guessed" rule as viatorFlagLabels in viator.ts. */
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  night_club: 'Nightclub',
  cafe: 'Café',
  brewery: 'Brewery',
  bakery: 'Bakery',
  pub: 'Pub',
  wine_bar: 'Wine bar',
  other: 'Other',
};

export function placeCategoryLabel(place: Place): string {
  return CATEGORY_LABELS[place.category] ?? place.category;
}

/** "Thai · Restaurant" when a cuisine is known, else just "Restaurant". */
export function placeMetaLine(place: Place): string {
  return [place.cuisine, placeCategoryLabel(place)].filter(Boolean).join(' · ');
}

const PLACES: Record<string, Place> = {};

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: Place[] = [];
let snapshotCity: string | null = null;
const EMPTY_PLACES: Place[] = [];

function notify() {
  snapshot = Object.values(PLACES);
  snapshotCity = activeCity();
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Place[] {
  return snapshot;
}

/** Reactive read of every hydrated place — re-renders the caller once real rows land. */
export function useAllPlaces(): Place[] {
  const city = useActiveCity();
  const places = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshotCity === city ? places : EMPTY_PLACES;
}

// ── Real coordinates for curated entries ────────────────────────────────────
// Hand-picked Restaurant/Venue rows in lib/data.ts carry a verified address but
// no lat/lon (never geocoded — see the header note in lib/geo.ts). The synced
// places table does carry real coordinates for the same Oakland/East Bay
// footprint, so when a curated spot is present there too its coordinates can be
// borrowed rather than invented. Anything that doesn't match confidently stays
// null, which keeps distance sorting honest: unresolved entries sort last
// instead of getting an estimated position.

/** "The Cook & Her Farmer, Oakland" → "cook her farmer" — punctuation, accents,
 * articles, and the city name dropped so curated free-text names line up with
 * open-map names for the same spot. */
function matchKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|and|oakland)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Leading street number of an address, used only to reject a same-name match
 * at a different address (a second location of the same restaurant). */
function streetNumber(address: string | null | undefined): string | null {
  const match = address?.trim().match(/^(\d{1,5})\b/);
  return match ? match[1] : null;
}

// Name index, rebuilt only when the snapshot array identity changes (i.e. when
// notify() publishes newly hydrated rows) — sorting a full list would otherwise
// re-index the whole table once per item.
let indexedFrom: Place[] | null = null;
let curatedIndex = new Map<string, Place[]>();

function curatedIndexFor(places: Place[]): Map<string, Place[]> {
  if (indexedFrom === places) return curatedIndex;
  const index = new Map<string, Place[]>();
  for (const place of places) {
    const key = matchKey(place.name);
    if (!key) continue;
    const bucket = index.get(key);
    if (bucket) bucket.push(place);
    else index.set(key, [place]);
  }
  indexedFrom = places;
  curatedIndex = index;
  return index;
}

/** The synced Place row behind a curated entry, or null when no confident
 * match exists. Ambiguous name collisions resolve only when the street
 * number agrees. Shared by coordsForCurated (position) and hoursForCurated
 * (opening_hours) — both are just different fields off the same matched row. */
function resolvePlaceForCurated(
  entry: { name: string; address?: string | null },
  places: Place[],
): Place | null {
  if (!places.length) return null;
  const key = matchKey(entry.name);
  if (!key) return null;
  const index = curatedIndexFor(places);
  // Open-map names often carry a descriptive tail the curated name omits
  // ("Farmhouse Kitchen" vs "Farmhouse Kitchen Thai Cuisine"), so an exact-key
  // miss falls back to keys the curated name prefixes. Never the reverse: a
  // curated name longer than the map name is a different, more specific place.
  const candidates = index.get(key) ?? [...index.entries()].flatMap(([indexed, group]) => (indexed.startsWith(`${key} `) ? group : []));
  if (!candidates.length) return null;

  const number = streetNumber(entry.address);
  if (candidates.length === 1) {
    const [place] = candidates;
    const placeNumber = streetNumber(place.address);
    if (number && placeNumber && number !== placeNumber) return null;
    return place;
  }

  if (!number) return null;
  return candidates.find((place) => streetNumber(place.address) === number) ?? null;
}

/** Real coordinates for a curated entry, or null when no confident match exists. */
export function coordsForCurated(
  entry: { name: string; address?: string | null },
  places: Place[] = snapshot,
): GeoPoint | null {
  const place = resolvePlaceForCurated(entry, places);
  return place ? { latitude: place.lat, longitude: place.lon } : null;
}

/** Real OSM opening_hours for a curated entry, or null when no confident match
 * exists or the matched row has none. Curated Restaurant rows carry no hours
 * field of their own (hand-picked, not geocoded) — this is the only real,
 * machine-readable hours signal available for them, read with lib/hours.ts. */
export function hoursForCurated(
  entry: { name: string; address?: string | null },
  places: Place[] = snapshot,
): string | null {
  return resolvePlaceForCurated(entry, places)?.openingHours ?? null;
}

/** Reactive form of coordsForCurated — the returned resolver is recreated once
 * fresh places hydrate, so a screen that sorted before hydration re-sorts. */
export function useCuratedCoords(): (entry: { name: string; address?: string | null }) => GeoPoint | null {
  const places = useAllPlaces();
  return useCallback((entry: { name: string; address?: string | null }) => coordsForCurated(entry, places), [places]);
}

/** Reactive form of hoursForCurated — same hydration-timing guarantee as useCuratedCoords. */
export function useCuratedHours(): (entry: { name: string; address?: string | null }) => string | null {
  const places = useAllPlaces();
  return useCallback((entry: { name: string; address?: string | null }) => hoursForCurated(entry, places), [places]);
}

// Which city the current contents describe. Null means nothing has loaded yet;
// a different slug means the guest changed city and what is held belongs to the
// city they left.
let hydratedCity: string | null = null;

// Last-known-good snapshot for offline cold launches — the backend is always
// the fresher source when reachable (see DATA.md); this only fills the gap
// before a network fetch can land, or replaces it entirely when there's no
// connection at all. Never a substitute for a successful fetch, only a
// fallback for when one hasn't happened yet.
const CACHE_BASE = 'wayvee.places.cache.v1';

async function loadPlacesFromCache(): Promise<void> {
  const raw = await getStoredItem(cityCacheKey(CACHE_BASE));
  if (!raw) return;
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows) || !rows.length) return;
    for (const place of rows as Place[]) {
      if (!place?.id || !place.name || place.lat == null || place.lon == null) continue;
      // A cache written before opening_hours existed has no such field; normalize
      // it to null so a stale cache reads as "hours unknown", not as undefined.
      PLACES[place.id] = { ...place, openingHours: place.openingHours ?? null };
    }
    notify();
  } catch {
    // Corrupt cache — ignore, the next successful network fetch overwrites it.
  }
}

function savePlacesToCache(): void {
  void setStoredItem(cityCacheKey(CACHE_BASE), JSON.stringify(Object.values(PLACES))).catch(() => {});
}

/** Fetch backend-synced places. Returns true when fresh rows landed.
 * Pass force=true (pull-to-refresh) to bypass the one-shot cache and refetch. */
export async function hydratePlacesFromBackend(force = false): Promise<boolean> {
  const city = activeCity();
  const hydrated = hydratedCity === city;
  if (hydrated && !force) return false;
  if (snapshotCity !== null && snapshotCity !== city) {
    // Switched city: drop the previous one's rows before the new ones land,
    // so the two are never on screen together.
    for (const id of Object.keys(PLACES)) delete PLACES[id];
    notify();
  }
  if (!supabase) {
    if (!hydrated) await loadPlacesFromCache();
    return false;
  }
  try {
    const { data, error } = await supabase.from('places').select('*').eq('city', city);
    if (city !== activeCity()) return false;
    if (error || !data?.length) {
      if (!hydrated) await loadPlacesFromCache();
      return false;
    }
    for (const row of data as unknown as PlaceRow[]) {
      if (!row?.id || !row.name || row.lat == null || row.lon == null) continue;
      PLACES[row.id] = rowToPlace(row);
    }
    hydratedCity = city;
    notify();
    savePlacesToCache();
    return true;
  } catch {
    if (!hydrated) await loadPlacesFromCache();
    return false;
  }
}
