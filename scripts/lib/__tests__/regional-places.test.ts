/** @jest-environment node */
import {
  COUNTY_NAMES, SOURCE_ELEMENT_CAP, SOURCE_BODY_CAP, BatchTooLarge,
  SourceBudget, SourceBudgetExhausted, SourceRequestError, boundedInteger,
  initialBatches, splitBatch, overpassQuery, parsePlaces, dedupePlaces,
  matchIdentity, failureRetryAt, type OverpassElement, type RegionalWrite,
} from '../regional-places';

const now = Date.parse('2026-10-25T12:00:00Z');
const sf = initialBatches().find(batch => batch.county === 'San Francisco')!;
const boundary: OverpassElement = { type: 'relation', id: 99, tags: { name: 'San Francisco', boundary: 'administrative', admin_level: '6' } };
const feature = (id: number, tags: Record<string, string> = {}, point = { lat: 37.77, lon: -122.42 }): OverpassElement => ({
  type: 'node', id, ...point, tags: { name: 'Café Fern', amenity: 'cafe', 'addr:housenumber': '100', 'addr:street': 'Main St', ...tags },
});
const payload = (elements: OverpassElement[]) => ({ elements: [boundary, { ...boundary, type: 'area' as const, id: boundary.id + 3_600_000_000 }, ...elements], osm3s: { timestamp_osm_base: '2026-10-25T10:00:00Z' } });
const place = (override: Partial<RegionalWrite> = {}): RegionalWrite => ({
  ...parsePlaces(payload([feature(1)]), sf, now)[0], ...override,
});

it('covers nine counties with unique nonoverlapping scheduling tiles and safe source queries', () => {
  const batches = initialBatches();
  expect(new Set(batches.map(batch => batch.county))).toEqual(new Set(COUNTY_NAMES));
  expect(new Set(batches.map(batch => batch.id)).size).toBe(batches.length);
  expect(batches.length).toBe(50);
  for (const batch of batches) {
    expect(batch.max_lat - batch.min_lat).toBeLessThanOrEqual(0.500001);
    expect(batch.max_lon - batch.min_lon).toBeLessThanOrEqual(0.500001);
    expect(batch.min_lat).toBeLessThan(batch.max_lat);
    expect(batch.min_lon).toBeLessThan(batch.max_lon);
  }
  const query = overpassQuery(sf);
  expect(query).toContain('area["ISO3166-2"="US-CA"]');
  expect(query).toContain('nwr(area.countyArea)');
  expect(query).toContain('out body center 4001');
  expect(query).toContain('trailhead');
  expect(query).toContain('museum');
  expect(query).toContain('nature_reserve');
  expect(() => overpassQuery({ ...sf, county: 'outside region' })).toThrow('unknown collection county');
});

it('subdivides oversized batches without gaps and never discards a capped source response', () => {
  const children = splitBatch(sf);
  expect(children).toHaveLength(4);
  expect(new Set(children.map(child => child.id)).size).toBe(4);
  const totalArea = children.reduce((total, child) => total + (child.max_lat - child.min_lat) * (child.max_lon - child.min_lon), 0);
  expect(totalArea).toBeCloseTo((sf.max_lat - sf.min_lat) * (sf.max_lon - sf.min_lon), 10);
  expect(children[0].max_lon).toBe(children[1].min_lon);
  expect(children[0].max_lat).toBe(children[2].min_lat);
  expect(() => splitBatch({ ...sf, depth: 4 })).toThrow('maximum subdivision');
  expect(() => parsePlaces(payload(Array.from({ length: SOURCE_ELEMENT_CAP + 1 }, (_, id) => feature(id + 1))), sf)).toThrow(BatchTooLarge);
});

it('retains only published identity fields and distinguishes OSM element types', () => {
  const node = feature(1, { cuisine: 'vietnamese;noodle', opening_hours: 'Mo-Fr 10:00-22:00', website: 'https://fern.example/', image: 'https://unverified.example/photo.jpg' });
  const way: OverpassElement = { type: 'way', id: 1, center: { lat: 37.771, lon: -122.421 }, tags: { name: 'Café Fern Annex', amenity: 'cafe' } };
  const records = parsePlaces(payload([node, way, node]), sf, now);
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({ id: 'osm:node:1', source_osm_ids: ['node/1'], opening_hours: 'Mo-Fr 10:00-22:00', city: 'san-francisco', cuisine: 'Vietnamese' });
  expect(records[1]).toMatchObject({ id: 'osm:way:1', lat: 37.771, lon: -122.421, address: null, website: null });
  expect(records[0]).not.toHaveProperty('image');
  expect(records[0]).not.toHaveProperty('detail_content');
  expect(records[0].source_url).toBe('https://www.openstreetmap.org/node/1');
  expect(records[0].source_data_at).toBe('2026-10-25T10:00:00.000Z');
});

it('keeps explicit parks, trailheads and venues without inventing route or event facts', () => {
  const parks = parsePlaces(payload([
    feature(10, { amenity: '', leisure: 'park', name: 'Fern Park' }),
    feature(11, { amenity: '', highway: 'trailhead', name: 'Fern Trailhead' }),
    feature(12, { amenity: 'theatre', name: 'Fern Theatre' }),
    feature(13, { amenity: '', tourism: 'museum', name: 'Fern Museum' }),
    feature(14, { amenity: '', leisure: 'garden', access: 'private' }),
  ]), sf);
  expect(parks.map(record => record.category)).toEqual(['park', 'trailhead', 'theatre', 'museum']);
  for (const record of parks) {
    expect(record).not.toHaveProperty('difficulty');
    expect(record).not.toHaveProperty('starts_at');
    expect(record).not.toHaveProperty('route_length');
  }
});

it('rejects missing county boundaries, partial responses, invalid coordinates and unsafe websites', () => {
  expect(() => parsePlaces({ elements: [feature(1)] }, sf)).toThrow('county boundary');
  expect(() => parsePlaces({ elements: [boundary] }, sf)).toThrow('mapped source county area');
  expect(() => parsePlaces({ ...payload([]), remark: 'runtime error: timeout' }, sf)).toThrow('incomplete data');
  const invalid = [
    feature(1, { name: '' }), feature(2, { disused: 'yes' }),
    feature(3, {}, { lat: Number.NaN, lon: -122.4 }),
    feature(4, {}, { lat: 38, lon: 0 }),
    { ...feature(5), lat: undefined, lon: undefined },
    feature(6, { access: 'no' }),
  ];
  expect(parsePlaces(payload(invalid), sf)).toEqual([]);
  for (const website of ['javascript:alert(1)', 'https://127.0.0.1/', 'http://10.0.0.1/', 'https://x.local/', 'https://user:pass@example.com/']) {
    expect(parsePlaces(payload([feature(7, { website })]), sf)[0].website).toBeNull();
  }
});

it('preserves canonical IDs, typed aliases and review flags while deduping cross-source records', () => {
  const original = place({ id: 'overture:known', source_overture_id: 'known', source_osm_ids: [], needs_review: true });
  const writes = dedupePlaces([place(), place({ id: 'osm:way:2', source_osm_id: 'way/2', source_osm_ids: ['way/2'], lat: 37.77001 })], [original]);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ id: 'overture:known', confidence: 'cross_confirmed', needs_review: true });
  expect(writes[0].source_osm_ids).toEqual(['node/1', 'way/2']);
  const moved = place({ lat: 37.9, name: 'A different business' });
  const movedWrite = dedupePlaces([moved], [place()])[0];
  expect(movedWrite.id).toBe('osm:node:1');
  expect(movedWrite.needs_review).toBe(true);
});

it('does not merge different addresses, distinct chain branches, weak fuzzy names or ambiguous candidates', () => {
  const incoming = place();
  expect(matchIdentity(incoming, [place({ id: 'other', source_osm_ids: [], address: '102 Main St' })])).toBeUndefined();
  expect(matchIdentity(incoming, [place({ id: 'other', source_osm_ids: [], lat: 37.772 })])).toBeUndefined();
  expect(matchIdentity(incoming, [place({ id: 'other', source_osm_ids: [], name: 'Cafe Birch' })])).toBeUndefined();
  expect(matchIdentity(incoming, [place({ id: 'a', source_osm_ids: [] }), place({ id: 'b', source_osm_ids: [] })])).toBeUndefined();
  const fuzzy = place({ name: 'Fern Coffee House', id: 'a', source_osm_ids: [] });
  expect(matchIdentity(place({ name: 'Fern Coffee Hause' }), [fuzzy])?.id).toBe('a');
  expect(matchIdentity(place({ name: 'Fern Coffee Hause', address: null }), [{ ...fuzzy, address: null }])).toBeUndefined();
});

it('counts failed HTTP calls against the source budget and respects request spacing', async () => {
  const calls = jest.fn(async () => new Response('busy', { status: 503 }));
  const wait = jest.fn(async () => undefined);
  const budget = new SourceBudget(2, calls as typeof fetch, wait, () => now);
  await expect(budget.read('query')).rejects.toMatchObject({ message: 'Overpass HTTP 503', retryable: true });
  await expect(budget.read('query')).rejects.toBeInstanceOf(SourceRequestError);
  await expect(budget.read('query')).rejects.toBeInstanceOf(SourceBudgetExhausted);
  expect(calls).toHaveBeenCalledTimes(2);
  expect(wait).toHaveBeenCalledWith(10_000);
  expect(budget.requests).toBe(2);
  expect((calls.mock.calls[0] as unknown[])[1]).toMatchObject({ redirect: 'error' });
});

it('propagates Retry-After, refuses partial JSON and bounds response bodies', async () => {
  const rateLimited = new SourceBudget(1, (async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } })) as typeof fetch);
  await expect(rateLimited.read('q')).rejects.toMatchObject({ retryAfterMs: 120_000 });
  const partial = new SourceBudget(1, (async () => Response.json({ elements: [], remark: 'timeout' })) as typeof fetch);
  await expect(partial.read('q')).rejects.toThrow('partial/error');
  const oversized = new SourceBudget(1, (async () => new Response(new Uint8Array(SOURCE_BODY_CAP + 1))) as typeof fetch);
  await expect(oversized.read('q')).rejects.toBeInstanceOf(BatchTooLarge);
  const paused = new SourceBudget(0, jest.fn() as typeof fetch);
  await expect(paused.read('q')).rejects.toBeInstanceOf(SourceBudgetExhausted);
});

it('bounds operator budgets and uses durable, increasing retry times', () => {
  expect(boundedInteger(undefined, 6, 12)).toBe(6);
  expect(boundedInteger('0', 6, 12)).toBe(0);
  for (const invalid of ['13', '-1', 'NaN', '1.5']) expect(() => boundedInteger(invalid, 6, 12)).toThrow();
  expect(Date.parse(failureRetryAt(1, now)) - now).toBe(3_600_000);
  expect(Date.parse(failureRetryAt(2, now)) - now).toBe(4 * 3_600_000);
  expect(Date.parse(failureRetryAt(99, now)) - now).toBe(24 * 3_600_000);
});
