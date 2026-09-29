// Bulk restaurants/bars/venues for Oakland + the East Bay, pulled from two
// independently-licensed open geodata sources — Overture Maps (CDLA-
// Permissive-2.0, via DuckDB reading Overture's public S3 GeoParquet release)
// and OpenStreetMap (ODbL, via the Overpass API) — and cross-checked against
// each other before landing in public.places. Same "sync script writes,
// client just reads" pattern as sync-viator.ts / sync-events.ts.
//
// No scraping of Yelp/Google — both those sources' terms either cost real
// money at this volume or prohibit caching the results, see
// docs/how-we-make-money.md for that reasoning. Overture and OSM are
// explicitly fine to store and redisplay.
//
// Requires env:
//   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// NOTE: Overture's Places parquet schema (column names, exact category enum
// strings, release path) could not be fully confirmed against live docs while
// writing this script — the DuckDB block below is written defensively (logs
// the first raw row, best-effort/non-fatal on failure) specifically so the
// first real run is cheap to eyeball and fix, same discipline as
// sync-viator.ts's PICK_LIMIT_PER_DESTINATION comment.
import { DuckDBInstance } from '@duckdb/node-api';

import type { City, CityBbox } from './lib/cities';
import { withCitySyncRuns, serviceClient, type SyncOutcome } from './lib/sync-run';

const supabase = serviceClient('sync places');

// Oakland + immediate East Bay (Berkeley, Emeryville, Alameda) — kept tight to
// what's actually relevant to a Downtown Oakland guest, same framing as
// DESTINATION_QUERIES in sync-viator.ts.

const TOTAL_CAP = 500;

// Bumping this to a newer dated release (see docs.overturemaps.org/release-notes,
// or list s3://overturemaps-us-west-2/release/) is a one-line change.
const OVERTURE_RELEASE = '2026-06-17.0';
const OVERTURE_PLACES_PATH = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=places/type=place/*`;

type PlaceCategory = 'restaurant' | 'bar' | 'night_club' | 'cafe' | 'brewery' | 'bakery' | 'pub' | 'wine_bar' | 'other';

/** Keyword buckets used against BOTH Overture's categories.primary string and
 * OSM's amenity/shop tag values — substring matching instead of trusting an
 * exact enum spelling from either source, which wasn't fully verifiable
 * against live docs while writing this. */
const CATEGORY_KEYWORDS: [PlaceCategory, string[]][] = [
  ['night_club', ['night_club', 'nightclub']],
  ['brewery', ['brewery', 'beer_garden', 'biergarten']],
  ['wine_bar', ['wine_bar', 'wine_shop']],
  ['pub', ['pub']],
  ['bar', ['bar', 'cocktail']],
  ['cafe', ['cafe', 'coffee']],
  ['bakery', ['bakery']],
  // Widened deliberately — cuisine-specific Overture/OSM categories don't all
  // spell out "restaurant" (pizzeria, taqueria, steakhouse, ice_cream_shop…),
  // so this net needs to be wide for cuisine diversity to actually show up.
  ['restaurant', [
    'restaurant', 'bistro', 'diner', 'food_court', 'fast_food', 'eatery',
    'steakhouse', 'pizzeria', 'pizza', 'bbq', 'barbecue', 'ice_cream',
    'food_truck', 'buffet', 'grill', 'kitchen', 'noodle', 'taqueria', 'sushi', 'deli',
  ]],
];

function normalizeCategory(raw: string | null | undefined): PlaceCategory | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => value.includes(keyword))) return category;
  }
  return null;
}

/** "vietnamese_restaurant" -> "Vietnamese", "brazilian_steakhouse" -> "Brazilian
 * steakhouse", "cafe" -> null (not a cuisine). Cheap, general — no hardcoded
 * cuisine list to keep in sync, since Overture's taxonomy already encodes
 * cuisine directly in most food-specific category strings. */
function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cuisineFromOvertureCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (!/_restaurant$|_food$|steakhouse|pizzeria|bbq|barbecue|ice_cream|food_truck/.test(value)) return null;
  const cleaned = value.replace(/_restaurant$/, '').replace(/_/g, ' ').trim();
  if (!cleaned || cleaned === 'fast' || cleaned === 'food court') return null;
  return titleCase(cleaned);
}

/** OSM's cuisine tag is semicolon-multi-value ("italian;pizza") — first value
 * only, to keep this a single readable label rather than a run-on string. */
function cuisineFromOsmTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(';')[0]?.trim();
  if (!first) return null;
  return titleCase(first.replace(/_/g, ' '));
}

interface RawPlace {
  sourceId: string;
  source: 'overture' | 'osm';
  name: string;
  category: PlaceCategory;
  cuisine: string | null;
  address: string | null;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  image: string | null;
  /** OSM's `opening_hours` tag, verbatim. Overture's places schema carries no
   * comparable field, so this is OSM-only — null everywhere else, never
   * inferred from a category. See src/lib/hours.ts for how it's read. */
  openingHours: string | null;
}

/** Best-effort — a schema mismatch here shouldn't take down the OSM half of
 * the sync. Logs the first raw row so a real run's Actions log makes it
 * obvious which field names need adjusting. */
async function fetchOverturePlaces(bbox: CityBbox): Promise<RawPlace[]> {
  try {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    await connection.runAndReadAll('INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;');
    await connection.runAndReadAll("SET s3_region='us-west-2';");

    const sql = `
      SELECT
        id,
        names.primary AS name,
        categories.primary AS category,
        addresses[1].freeform AS address,
        bbox.xmin AS lon,
        bbox.ymin AS lat,
        websites[1] AS website,
        phones[1] AS phone
      FROM read_parquet('${OVERTURE_PLACES_PATH}', filename=true, hive_partitioning=1)
      WHERE bbox.xmin BETWEEN ${bbox.minLon} AND ${bbox.maxLon}
        AND bbox.ymin BETWEEN ${bbox.minLat} AND ${bbox.maxLat}
        AND (
          categories.primary ILIKE '%restaurant%' OR categories.primary ILIKE '%bar%'
          OR categories.primary ILIKE '%cafe%' OR categories.primary ILIKE '%coffee%'
          OR categories.primary ILIKE '%night_club%' OR categories.primary ILIKE '%pub%'
          OR categories.primary ILIKE '%brewery%' OR categories.primary ILIKE '%bakery%'
          OR categories.primary ILIKE '%bistro%' OR categories.primary ILIKE '%diner%'
          OR categories.primary ILIKE '%wine%' OR categories.primary ILIKE '%steakhouse%'
          OR categories.primary ILIKE '%pizz%' OR categories.primary ILIKE '%bbq%'
          OR categories.primary ILIKE '%barbecue%' OR categories.primary ILIKE '%ice_cream%'
          OR categories.primary ILIKE '%food_truck%' OR categories.primary ILIKE '%buffet%'
          OR categories.primary ILIKE '%noodle%' OR categories.primary ILIKE '%taqueria%'
          OR categories.primary ILIKE '%sushi%' OR categories.primary ILIKE '%deli%'
        )
      LIMIT 6000;
    `;
    const reader = await connection.runAndReadAll(sql);
    const rows = reader.getRowObjects() as Record<string, unknown>[];
    if (rows[0]) console.log('overture: first raw row ->', JSON.stringify(rows[0]));

    const places: RawPlace[] = [];
    for (const row of rows) {
      const rawCategory = row.category as string | null;
      const category = normalizeCategory(rawCategory);
      const lat = row.lat as number | null;
      const lon = row.lon as number | null;
      if (!category || !row.name || lat == null || lon == null) continue;
      places.push({
        sourceId: String(row.id),
        source: 'overture',
        name: String(row.name),
        category,
        cuisine: cuisineFromOvertureCategory(rawCategory),
        address: (row.address as string | null) ?? null,
        lat,
        lon,
        website: (row.website as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        image: null, // Overture's places schema doesn't carry photos
        openingHours: null, // …nor machine-readable hours; OSM supplies those
      });
    }
    console.log(`overture: ${places.length} candidate places after category/field filtering`);
    return places;
  } catch (error) {
    console.error('overture fetch failed (continuing with OSM only):', (error as Error).message);
    return [];
  }
}

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function fetchOsmPlaces(bbox: CityBbox): Promise<RawPlace[]> {
  // Widened deliberately for cuisine diversity — amenity=restaurant/fast_food
  // already covers every cuisine (cuisine is a separate tag layered on top),
  // but ice_cream/food_court aren't tagged as either and were being dropped.
  const amenityValues = ['restaurant', 'bar', 'pub', 'cafe', 'nightclub', 'fast_food', 'biergarten', 'ice_cream', 'food_court'];
  const shopValues = ['wine', 'bakery', 'coffee', 'deli'];
  const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
  const query = `
    [out:json][timeout:90];
    (
      node["amenity"~"^(${amenityValues.join('|')})$"](${bboxStr});
      way["amenity"~"^(${amenityValues.join('|')})$"](${bboxStr});
      node["shop"~"^(${shopValues.join('|')})$"](${bboxStr});
    );
    out center tags;
  `;

  // Overpass's free public instances see genuine load spikes ("server is
  // probably too busy" — confirmed on a live run: 504 from overpass-api.de,
  // no code bug involved). A few retries with backoff plus a fallback mirror
  // is the honest fix for that, not a header/encoding change like the two
  // earlier real bugs this pipeline had.
  const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    // No default Accept header from Node's fetch (undici) drew a 406 from
    // overpass-api.de on a live run — this is required, not just polite.
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'Wayvee-places-sync/1.0 (+https://wayvee.app)',
  };
  const body = new URLSearchParams({ data: query }).toString();

  let lastError: Error | null = null;
  let data: { elements: OverpassElement[] } | null = null;
  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 3 && !data; attempt += 1) {
      try {
        const res = await fetch(endpoint, { method: 'POST', headers, body });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`);
        data = (await res.json()) as { elements: OverpassElement[] };
      } catch (error) {
        lastError = error as Error;
        console.warn(`  osm attempt failed (${endpoint}, try ${attempt + 1}/3):`, lastError.message.slice(0, 200));
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
      }
    }
    if (data) break;
  }

  try {
    if (!data) throw lastError ?? new Error('osm fetch failed with no captured error');

    const places: RawPlace[] = [];
    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {};
      const name = tags.name;
      if (!name) continue;
      const category = normalizeCategory(tags.amenity) ?? normalizeCategory(tags.shop);
      if (!category) continue;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;

      const addressParts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean);
      const image = tags.wikimedia_commons
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(tags.wikimedia_commons.replace(/^File:/, ''))}`
        : null;

      places.push({
        sourceId: String(el.id),
        source: 'osm',
        name,
        category,
        cuisine: cuisineFromOsmTag(tags.cuisine),
        address: addressParts.length ? addressParts.join(' ') : null,
        lat,
        lon,
        website: tags.website ?? tags['contact:website'] ?? null,
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        image,
        openingHours: tags.opening_hours ?? null,
      });
    }
    console.log(`osm: ${places.length} candidate places after tag filtering`);
    return places;
  } catch (error) {
    console.error('osm fetch failed:', (error as Error).message);
    return [];
  }
}

function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(restaurant|bar|cafe|the|llc|inc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plain Levenshtein distance — small strings (business names), no need for a dependency. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const distance = levenshtein(na, nb);
  return 1 - distance / Math.max(na.length, nb.length);
}

const MATCH_DISTANCE_METERS = 75;
const MATCH_NAME_SIMILARITY = 0.6;

interface ConflatedPlace {
  id: string;
  name: string;
  category: PlaceCategory;
  cuisine: string | null;
  address: string | null;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  image: string | null;
  openingHours: string | null;
  confidence: 'cross_confirmed' | 'overture_only' | 'osm_only';
  needsReview: boolean;
  sourceOvertureId: string | null;
  sourceOsmId: string | null;
}

/** Matches Overture <-> OSM records by proximity + fuzzy name, merges fields
 * (prefer whichever side has a non-null value), and flags a mismatched
 * category between the two sources for manual review rather than silently
 * picking one. Unmatched records on either side are kept as single-source. */
function conflate(overture: RawPlace[], osm: RawPlace[]): ConflatedPlace[] {
  const usedOsm = new Set<number>();
  const merged: ConflatedPlace[] = [];

  for (const o of overture) {
    let bestIndex = -1;
    let bestSimilarity = 0;
    osm.forEach((candidate, index) => {
      if (usedOsm.has(index)) return;
      const distance = haversineMeters(o.lat, o.lon, candidate.lat, candidate.lon);
      if (distance > MATCH_DISTANCE_METERS) return;
      const similarity = nameSimilarity(o.name, candidate.name);
      if (similarity >= MATCH_NAME_SIMILARITY && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = index;
      }
    });

    if (bestIndex === -1) {
      merged.push({
        id: `overture:${o.sourceId}`,
        name: o.name,
        category: o.category,
        cuisine: o.cuisine,
        address: o.address,
        lat: o.lat,
        lon: o.lon,
        website: o.website,
        phone: o.phone,
        image: o.image,
        openingHours: o.openingHours,
        confidence: 'overture_only',
        needsReview: false,
        sourceOvertureId: o.sourceId,
        sourceOsmId: null,
      });
      continue;
    }

    const match = osm[bestIndex];
    usedOsm.add(bestIndex);
    merged.push({
      id: `overture:${o.sourceId}`,
      name: o.name,
      category: o.category,
      cuisine: o.cuisine ?? match.cuisine,
      address: o.address ?? match.address,
      lat: o.lat,
      lon: o.lon,
      website: o.website ?? match.website,
      phone: o.phone ?? match.phone,
      image: o.image ?? match.image,
      openingHours: o.openingHours ?? match.openingHours,
      confidence: 'cross_confirmed',
      needsReview: o.category !== match.category,
      sourceOvertureId: o.sourceId,
      sourceOsmId: match.sourceId,
    });
  }

  osm.forEach((o, index) => {
    if (usedOsm.has(index)) return;
    merged.push({
      id: `osm:${o.sourceId}`,
      name: o.name,
      category: o.category,
      cuisine: o.cuisine,
      address: o.address,
      lat: o.lat,
      lon: o.lon,
      website: o.website,
      phone: o.phone,
      image: o.image,
      openingHours: o.openingHours,
      confidence: 'osm_only',
      needsReview: false,
      sourceOvertureId: null,
      sourceOsmId: o.sourceId,
    });
  });

  return merged;
}

/** Cross-confirmed places first (highest confidence), then single-source. */
function rankAndCap(places: ConflatedPlace[], cap: number): ConflatedPlace[] {
  const rank = { cross_confirmed: 0, overture_only: 1, osm_only: 2 } as const;
  return [...places].sort((a, b) => rank[a.confidence] - rank[b.confidence]).slice(0, cap);
}

void withCitySyncRuns(supabase, 'places', async (city: City): Promise<SyncOutcome> => {
  const runStartedAt = new Date().toISOString();
  const [overturePlaces, osmPlaces] = await Promise.all([fetchOverturePlaces(city.bbox), fetchOsmPlaces(city.bbox)]);

  if (!overturePlaces.length && !osmPlaces.length) {
    throw new Error('no places fetched from either source — nothing written');
  }

  const conflated = conflate(overturePlaces, osmPlaces);
  const crossConfirmed = conflated.filter((p) => p.confidence === 'cross_confirmed').length;
  console.log(`conflated: ${conflated.length} total, ${crossConfirmed} cross-confirmed`);

  const capped = rankAndCap(conflated, TOTAL_CAP);

  const distinctCuisines = new Set(capped.map((p) => p.cuisine).filter((c): c is string => c != null));
  const withCuisine = capped.filter((p) => p.cuisine != null).length;
  console.log(`cuisine: ${withCuisine}/${capped.length} rows tagged, ${distinctCuisines.size} distinct -> ${[...distinctCuisines].sort().join(', ')}`);

  const rows = capped.map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    cuisine: place.cuisine,
    address: place.address,
    lat: place.lat,
    lon: place.lon,
    website: place.website,
    phone: place.phone,
    image: place.image,
    opening_hours: place.openingHours,
    confidence: place.confidence,
    needs_review: place.needsReview,
    source_overture_id: place.sourceOvertureId,
    source_osm_id: place.sourceOsmId,
    city: city.slug,
    synced_at: runStartedAt,
  }));

  const withHours = rows.filter((row) => row.opening_hours != null).length;
  console.log(`hours: ${withHours}/${rows.length} rows carry an OSM opening_hours tag`);

  const { error: upsertError } = await supabase.from('places').upsert(rows);
  if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);

  // Every row this run touched shares runStartedAt as synced_at, so anything older
  // is stale (renamed/closed/dropped out of this run's top 500) — a straightforward
  // cutoff instead of a NOT IN (500 quoted ids) list, which hit a query-length limit
  // on a live run (confirmed: "prune warning: Bad Request").
  //
  // Scoped to this city: every other city's rows carry an older synced_at by
  // definition, so an unscoped cutoff would delete the entire catalog except
  // whichever city happened to sync last.
  const { error: pruneError, count } = await supabase
    .from('places')
    .delete({ count: 'exact' })
    .eq('city', city.slug)
    .lt('synced_at', runStartedAt);
  if (pruneError) console.error('prune warning:', pruneError.message);

  console.log(`  synced ${rows.length} places to the backend (cap ${TOTAL_CAP})`);

  // One source going dark still produces a usable table, but it's a materially
  // thinner one (no cross-confirmation, and with OSM down, no hours at all) —
  // worth recording as degraded rather than clean.
  const missingSource = !overturePlaces.length ? 'overture' : !osmPlaces.length ? 'osm' : null;
  return {
    status: missingSource || pruneError ? 'partial' : 'ok',
    rowsWritten: rows.length,
    rowsPruned: count ?? 0,
    detail: missingSource
      ? `${missingSource} returned nothing; ${crossConfirmed} cross-confirmed, ${withHours} with hours`
      : `${crossConfirmed} cross-confirmed, ${withHours} with hours`,
  };
});
