/** Deterministic regional collection. No model calls, geocoding, or guessed
 * coordinates. Only small named-county Overpass queries reach a source. */
export const REGION = 'sf-bay-area';
export const SOURCE_ELEMENT_CAP = 4_000;
export const SOURCE_BODY_CAP = 4_000_000;
export const REFRESH_MS = 30 * 86_400_000;
export const MATCH_MARGIN_DEGREES = 0.001;

export interface Bounds { min_lat: number; min_lon: number; max_lat: number; max_lon: number }
export interface Batch extends Bounds {
  id: string;
  region: string;
  county: string;
  priority: number;
  depth: number;
  attempts: number;
}
export interface BatchState extends Batch {
  status: 'pending' | 'complete' | 'failed' | 'split';
  next_attempt_at: string;
  last_completed_at: string | null;
}
type Category = 'restaurant' | 'bar' | 'night_club' | 'cafe' | 'brewery' | 'bakery' | 'pub' | 'wine_bar'
  | 'theatre' | 'cinema' | 'arts_centre' | 'events_venue' | 'music_venue'
  | 'museum' | 'gallery' | 'park' | 'nature_reserve' | 'garden' | 'trailhead' | 'attraction' | 'viewpoint';
export interface Identity {
  id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lon: number;
  website: string | null;
  phone: string | null;
  city: string;
  source_osm_id: string | null;
  source_osm_ids: string[];
  source_overture_id?: string | null;
  needs_review: boolean;
}
export interface RegionalWrite extends Identity {
  cuisine: string | null;
  opening_hours: string | null;
  confidence: string;
  county: string;
  source_url: string;
  source_data_at: string | null;
  synced_at: string;
}
export interface OverpassElement {
  type: 'node' | 'way' | 'relation' | 'area';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
export interface OverpassPayload {
  elements?: OverpassElement[];
  remark?: string;
  osm3s?: { timestamp_osm_base?: string };
}

// Deliberately generous scheduling envelopes, not county geometries. The
// source county-area filter supplies the actual administrative boundary.
const COUNTIES: { name: string; bounds: Bounds; priority: number }[] = [
  { name: 'San Francisco', bounds: { min_lat: 37.6, min_lon: -123.1, max_lat: 37.9, max_lon: -122.25 }, priority: 0 },
  { name: 'San Mateo', bounds: { min_lat: 37.0, min_lon: -122.7, max_lat: 37.8, max_lon: -122.0 }, priority: 10 },
  { name: 'Alameda', bounds: { min_lat: 37.35, min_lon: -122.45, max_lat: 38.0, max_lon: -121.4 }, priority: 11 },
  { name: 'Santa Clara', bounds: { min_lat: 36.8, min_lon: -122.3, max_lat: 37.6, max_lon: -121.1 }, priority: 12 },
  { name: 'Contra Costa', bounds: { min_lat: 37.65, min_lon: -122.5, max_lat: 38.25, max_lon: -121.45 }, priority: 13 },
  { name: 'Marin', bounds: { min_lat: 37.75, min_lon: -123.15, max_lat: 38.4, max_lon: -122.3 }, priority: 14 },
  { name: 'Solano', bounds: { min_lat: 37.95, min_lon: -122.5, max_lat: 38.6, max_lon: -121.5 }, priority: 15 },
  { name: 'Napa', bounds: { min_lat: 38.05, min_lon: -122.75, max_lat: 38.95, max_lon: -122.0 }, priority: 16 },
  { name: 'Sonoma', bounds: { min_lat: 37.95, min_lon: -123.6, max_lat: 38.95, max_lon: -122.3 }, priority: 17 },
];
export const COUNTY_NAMES = COUNTIES.map(county => county.name);

export function localitySlug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const rounded = (value: number) => Number(value.toFixed(6));

export function initialBatches(): Batch[] {
  return COUNTIES.flatMap(({ name, bounds, priority }) => {
    // SF's smaller tiles avoid spending the first run on a dense oversized
    // response. Sort mainland tiles before the sparse county islands/ocean.
    const latStep = name === 'San Francisco' ? 0.15 : 0.5;
    const lonStep = name === 'San Francisco' ? 0.2 : 0.5;
    const rows = Math.ceil((bounds.max_lat - bounds.min_lat) / latStep - 1e-8);
    const cols = Math.ceil((bounds.max_lon - bounds.min_lon) / lonStep - 1e-8);
    return Array.from({ length: rows * cols }, (_, index) => {
      const y = Math.floor(index / cols), x = index % cols;
      return {
        id: `bay-v1:${localitySlug(name)}:${y}:${x}`, region: REGION, county: name,
        min_lat: rounded(bounds.min_lat + y * latStep), min_lon: rounded(bounds.min_lon + x * lonStep),
        max_lat: rounded(Math.min(bounds.max_lat, bounds.min_lat + (y + 1) * latStep)),
        max_lon: rounded(Math.min(bounds.max_lon, bounds.min_lon + (x + 1) * lonStep)),
        priority: name === 'San Francisco' && x < 2 ? 8 : priority, depth: 0, attempts: 0,
      };
    });
  });
}

export function splitBatch(batch: Batch): Batch[] {
  if (batch.depth >= 4) throw new Error('batch remains too large at maximum subdivision; inspect this county batch');
  const midLat = rounded((batch.min_lat + batch.max_lat) / 2);
  const midLon = rounded((batch.min_lon + batch.max_lon) / 2);
  return [
    [batch.min_lat, batch.min_lon, midLat, midLon],
    [batch.min_lat, midLon, midLat, batch.max_lon],
    [midLat, batch.min_lon, batch.max_lat, midLon],
    [midLat, midLon, batch.max_lat, batch.max_lon],
  ].map(([min_lat, min_lon, max_lat, max_lon], index) => ({
    ...batch, id: `${batch.id}:${index}`, min_lat, min_lon, max_lat, max_lon,
    depth: batch.depth + 1, attempts: 0,
  }));
}

export function countyNamePattern(county: string): string {
  if (!COUNTY_NAMES.includes(county)) throw new Error('unknown collection county');
  return county === 'San Francisco'
    ? '^(San Francisco|San Francisco County|City and County of San Francisco)$'
    : `^(${county}|${county} County)$`;
}

export function overpassQuery(batch: Batch): string {
  const { min_lat, min_lon, max_lat, max_lon } = batch;
  if (![min_lat, min_lon, max_lat, max_lon].every(Number.isFinite)
      || min_lat >= max_lat || min_lon >= max_lon) throw new Error('invalid batch bounds');
  const bbox = `${min_lat},${min_lon},${max_lat},${max_lon}`;
  // Printing the county relation confirms that an absent boundary cannot be
  // mistaken for a successfully collected empty tile. nwr includes relations.
  return `[out:json][timeout:45][maxsize:67108864];
area["ISO3166-2"="US-CA"]["admin_level"="4"]->.state;
rel(area.state)["boundary"="administrative"]["admin_level"="6"]["name"~"${countyNamePattern(batch.county)}"]->.county;
.county out tags;
.county map_to_area->.countyArea;
.countyArea out tags;
(
  nwr(area.countyArea)["amenity"~"^(restaurant|fast_food|food_court|ice_cream|bar|pub|cafe|nightclub|biergarten|theatre|cinema|arts_centre|events_venue|music_venue)$"](${bbox});
  nwr(area.countyArea)["shop"~"^(bakery|coffee|deli|wine)$"](${bbox});
  nwr(area.countyArea)["craft"="brewery"](${bbox});
  nwr(area.countyArea)["leisure"~"^(park|nature_reserve|garden)$"](${bbox});
  nwr(area.countyArea)["tourism"~"^(museum|gallery|attraction|viewpoint)$"](${bbox});
  nwr(area.countyArea)["highway"="trailhead"](${bbox});
);
out body center ${SOURCE_ELEMENT_CAP + 1};`;
}

export class BatchTooLarge extends Error {}
export class SourceBudgetExhausted extends Error {}
export class SourceRequestError extends Error {
  constructor(message: string, public readonly retryAfterMs = 0, public readonly retryable = true) { super(message); }
}

/** Counts every actual source fetch, including unsuccessful calls and retries.
 * Source concurrency is one. Injected clock/fetch make limits testable offline. */
export class SourceBudget {
  requests = 0;
  bytes = 0;
  private lastRequestAt = 0;
  constructor(
    readonly limit: number,
    private readonly request: typeof fetch = fetch,
    private readonly wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
    private readonly now: () => number = Date.now,
  ) {}

  async read(query: string): Promise<OverpassPayload> {
    if (this.requests >= this.limit) throw new SourceBudgetExhausted('source request budget reached');
    if (this.requests) await this.wait(Math.max(0, 10_000 - (this.now() - this.lastRequestAt)));
    this.requests++;
    this.lastRequestAt = this.now();
    const response = await this.request('https://overpass-api.de/api/interpreter', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: {
        Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WayveeRegionalCollector/1.0 (+https://github.com/wayvee-main/001; fixed Bay Area batches)',
      },
      body: new URLSearchParams({ data: query }).toString(),
    });
    if (!response.ok) {
      await response.body?.cancel();
      const retryHeader = response.headers.get('retry-after');
      const retryAfterMs = retryHeader && /^\d+$/.test(retryHeader)
        ? Number(retryHeader) * 1000 : Math.max(0, Date.parse(retryHeader || '') - this.now()) || 0;
      throw new SourceRequestError(`Overpass HTTP ${response.status}`, retryAfterMs, response.status === 429 || response.status >= 500);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new SourceRequestError('Overpass response has no body');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      this.bytes += part.value.byteLength;
      if (size > SOURCE_BODY_CAP) { await reader.cancel(); throw new BatchTooLarge('source tile exceeds body cap'); }
      chunks.push(part.value);
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder().decode(joined)) as OverpassPayload;
    if (!Array.isArray(data.elements)) throw new SourceRequestError('Overpass response has no elements');
    if (data.remark) throw new SourceRequestError('Overpass returned a partial/error response');
    return data;
  }
}

const categoryFor = (tags: Record<string, string>): Category | null => {
  if (tags.highway === 'trailhead') return 'trailhead';
  if (['theatre', 'cinema', 'arts_centre', 'events_venue', 'music_venue'].includes(tags.amenity)) return tags.amenity as Category;
  if (['museum', 'gallery', 'attraction', 'viewpoint'].includes(tags.tourism)) return tags.tourism as Category;
  if (['park', 'nature_reserve', 'garden'].includes(tags.leisure)) return tags.leisure as Category;
  if (tags.craft === 'brewery' || tags.amenity === 'biergarten') return 'brewery';
  if (tags.amenity === 'nightclub') return 'night_club';
  if (tags.amenity === 'pub') return 'pub';
  if (tags.amenity === 'bar') return 'bar';
  if (tags.shop === 'wine') return 'wine_bar';
  if (tags.shop === 'bakery') return 'bakery';
  if (tags.amenity === 'cafe' || tags.shop === 'coffee') return 'cafe';
  if (['restaurant', 'fast_food', 'food_court', 'ice_cream'].includes(tags.amenity) || tags.shop === 'deli') return 'restaurant';
  return null;
};
const clean = (value: unknown, max: number): string | null => typeof value === 'string' ? value.trim().slice(0, max) || null : null;
const safeWebsite = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    const url = new URL(value.split(';')[0].trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')
      || /(^localhost$|\.(local|internal|localhost)$|^(127|10|0)\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
};

export function parsePlaces(data: OverpassPayload, batch: Batch, now = Date.now()): RegionalWrite[] {
  if (data.remark || !Array.isArray(data.elements)) throw new SourceRequestError('Overpass returned incomplete data');
  const boundary = data.elements.filter(element => element.type === 'relation'
    && element.tags?.boundary === 'administrative' && element.tags.admin_level === '6'
    && new RegExp(countyNamePattern(batch.county)).test(element.tags.name || ''));
  if (boundary.length !== 1) throw new SourceRequestError('Expected exactly one source county boundary');
  const area = data.elements.filter(element => element.type === 'area' && element.id === boundary[0].id + 3_600_000_000);
  if (area.length !== 1) throw new SourceRequestError('Expected one mapped source county area');
  const sourceElements = data.elements.filter(element => !boundary.includes(element) && !area.includes(element));
  if (sourceElements.length >= SOURCE_ELEMENT_CAP + 1) throw new BatchTooLarge('source tile hit result cap');
  const stamp = data.osm3s?.timestamp_osm_base;
  const source_data_at = stamp && Number.isFinite(Date.parse(stamp)) ? new Date(stamp).toISOString() : null;
  const unique = new Map<string, RegionalWrite>();
  for (const element of sourceElements) {
    const tags = element.tags || {}, category = categoryFor(tags), name = clean(tags.name, 300);
    const lat = element.lat ?? element.center?.lat, lon = element.lon ?? element.center?.lon;
    if (!category || !name || !['node', 'way', 'relation'].includes(element.type)
      || !Number.isSafeInteger(element.id) || element.id <= 0 || typeof lat !== 'number' || typeof lon !== 'number'
      || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 36.8 || lat > 39.0 || lon < -123.7 || lon > -121.0) continue;
    if ([tags.disused, tags.abandoned, tags.demolished, tags.removed].some(value => value === 'yes')) continue;
    if (tags.access === 'no' || tags.access === 'private') continue;
    const sourceId = `${element.type}/${element.id}`;
    const cuisine = clean(tags.cuisine?.split(';')[0]?.replace(/_/g, ' '), 100);
    const sourceCity = clean(tags['addr:city'], 100);
    unique.set(sourceId, {
      id: `osm:${element.type}:${element.id}`, name, category,
      cuisine: cuisine ? cuisine[0].toUpperCase() + cuisine.slice(1) : null,
      address: clean(tags['addr:full'], 500) || clean([tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '), 500),
      lat, lon, website: safeWebsite(tags.website || tags['contact:website']),
      phone: clean(tags.phone || tags['contact:phone'], 100),
      opening_hours: clean(tags.opening_hours, 1000),
      city: sourceCity ? localitySlug(sourceCity) : batch.county === 'San Francisco' ? 'san-francisco' : REGION,
      county: batch.county, confidence: 'osm_only', needs_review: false,
      source_osm_id: sourceId, source_osm_ids: [sourceId],
      source_url: `https://www.openstreetmap.org/${sourceId}`,
      source_data_at, synced_at: new Date(now).toISOString(),
    });
  }
  return [...unique.values()];
}

export function metersBetween(a: Pick<Identity, 'lat' | 'lon'>, b: Pick<Identity, 'lat' | 'lon'>): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function normalizedName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(llc|inc)\b/g, '').replace(/\s+/g, ' ').trim();
}
const addressKey = (value: string | null) => normalizedName(value || '').replace(/\b(street|st)\b/g, 'st').replace(/\b(avenue|ave)\b/g, 'ave').replace(/\b(road|rd)\b/g, 'rd');
const phoneKey = (value: string | null) => (value || '').replace(/\D/g, '').slice(-10);
function nameSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 3) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
function compatibleCategories(a: string, b: string): boolean {
  if (a === b) return true;
  return ['restaurant', 'cafe', 'bakery'].includes(a) && ['restaurant', 'cafe', 'bakery'].includes(b);
}

/** Conservative nearby identity matching. Exact typed source aliases win.
 * Fuzzy names require matching full street addresses or published phones;
 * ambiguous matches remain separate, preserving distinct chain branches. */
export function matchIdentity(incoming: RegionalWrite, existing: Identity[]): Identity | undefined {
  const aliases = new Set(incoming.source_osm_ids);
  const exact = existing.filter(place => place.id === incoming.id || place.source_osm_ids.some(id => aliases.has(id)));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const incomingName = normalizedName(incoming.name), incomingAddress = addressKey(incoming.address);
  const matches = existing.filter(place => {
    if (!compatibleCategories(incoming.category, place.category) || metersBetween(incoming, place) > 30) return false;
    const otherAddress = addressKey(place.address);
    if (incomingAddress && otherAddress && incomingAddress !== otherAddress) return false;
    const similarity = nameSimilarity(incomingName, normalizedName(place.name));
    if (similarity === 1) return Boolean(incomingName) && (metersBetween(incoming, place) <= 12 || Boolean(incomingAddress && otherAddress));
    const samePhone = phoneKey(incoming.phone).length >= 7 && phoneKey(incoming.phone) === phoneKey(place.phone);
    return similarity >= 0.9 && (Boolean(incomingAddress && otherAddress) || samePhone);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function dedupePlaces(incoming: RegionalWrite[], existing: Identity[]): RegionalWrite[] {
  const known = [...existing], writes = new Map<string, RegionalWrite>();
  for (const place of incoming) {
    const match = matchIdentity(place, known);
    const merged: RegionalWrite = match ? {
      ...place, id: match.id,
      city: place.city === REGION ? match.city : place.city,
      source_osm_ids: [...new Set([...match.source_osm_ids, ...place.source_osm_ids])],
      needs_review: match.needs_review || normalizedName(match.name) !== normalizedName(place.name) && nameSimilarity(normalizedName(match.name), normalizedName(place.name)) < 0.8,
      confidence: match.source_overture_id ? 'cross_confirmed' : place.confidence,
      source_overture_id: match.source_overture_id,
    } : place;
    const prior = writes.get(merged.id);
    if (prior) merged.source_osm_ids = [...new Set([...prior.source_osm_ids, ...merged.source_osm_ids])];
    writes.set(merged.id, merged);
    const index = known.findIndex(candidate => candidate.id === merged.id);
    if (index === -1) known.push(merged); else known[index] = merged;
  }
  return [...writes.values()];
}

export function failureRetryAt(attempts: number, now = Date.now()): string {
  return new Date(now + [1, 4, 12, 24][Math.min(3, Math.max(0, attempts - 1))] * 3_600_000).toISOString();
}
export function boundedInteger(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) > max) throw new Error(`budget must be an integer between 0 and ${max}`);
  return Number(value);
}
