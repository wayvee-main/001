// Pulls real Ticketmaster Discovery API listings for Downtown Oakland and
// upserts them into the events table as source='ticketmaster' — same
// "sync script writes, client just reads" pattern as sync-events.ts and
// sync-viator.ts. The API key never reaches the app bundle.
//
// This is a SECOND source, not a replacement: the hand-verified bundle in
// src/lib/events.ts stays the offline/first-paint fallback and always wins a
// collision (see dedupe below). Ticketmaster fills the gap between daily
// manual refreshes for the ticketed venues it actually covers.
//
// Requires env:
//   TICKETMASTER_API_KEY      — Discovery API consumer key, never checked in
//   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   TICKETMASTER_DRY_RUN=1    — print what would be written, touch nothing
//
// Run: npm run sync:ticketmaster
//
// Rate limits on the default Discovery tier are 5000 calls/day and 5 requests
// per second; this script makes at most MAX_PAGES + 1 calls per run.
import type { SupabaseClient } from '@supabase/supabase-js';

import { EVENTS } from '../src/lib/events';
import { formatMiles, milesBetween, type GeoPoint } from '../src/lib/geo';
import type { City } from './lib/cities';
import { withCitySyncRuns, withSyncRun, serviceClient, type SyncOutcome } from './lib/sync-run';

const API_KEY = process.env.TICKETMASTER_API_KEY;
const DRY_RUN = process.env.TICKETMASTER_DRY_RUN === '1';

/** 12th St / Broadway (Oakland City Center BART) — the downtown anchor every
 * distance in this script is measured from. Discovery's radius search is
 * centred here too, so "close to the guest" is the query, not a post-filter. */
/** Only for TICKETMASTER_DRY_RUN, which runs without a database and so cannot
 * read public.cities. Every real run uses the city row's own anchor. */
const DRY_RUN_CITY: City = {
  slug: 'oakland',
  name: 'Oakland',
  timezone: 'America/Los_Angeles',
  anchor: { latitude: 37.8032, longitude: -122.2716 },
  bbox: { minLat: 37.705, minLon: -122.335, maxLat: 37.875, maxLon: -122.11 },
  viatorDestinations: [],
};
const RADIUS_MILES = 5;

/** Discovery caps deep paging at size*page <= 1000; 200 is the max page size. */
const PAGE_SIZE = 200;
const MAX_PAGES = 3;

const DAYS_AHEAD = 30;
/** Curation guards (principle 4): a firehose of 300 listings is not a concierge. */
const MAX_PER_VENUE = 3;
const MAX_TOTAL = 40;

/** Ticketmaster venue name -> catalog venue id in src/lib/data.ts. Exact,
 * hand-checked matches only — a fuzzy match here would attach listings to the
 * wrong venue page. Unlisted venues still sync, just without a venueId link. */
const VENUE_IDS: Record<string, string> = {
  'Fox Theater': 'fox',
  'Fox Theater Oakland': 'fox',
  'The Fox Theater': 'fox',
  'Paramount Theatre': 'paramount',
  'Paramount Theatre Oakland': 'paramount',
  'Yoshis': 'yoshis',
  "Yoshi's": 'yoshis',
  "Yoshi's Oakland": 'yoshis',
  "Eli's Mile High Club": 'elis',
};

/** Upsells and logistics, not things to go do. Ticketmaster returns these as
 * ordinary events; they are the main reason a raw feed reads as spam. */
const JUNK_TITLE = /parking|vip package|hotel package|meet\s*&\s*greet|upgrade|shuttle|gift card|season pass|payment plan/i;
/** Segment that carries parking passes, fees, and other non-events. */
const JUNK_SEGMENTS = new Set(['Miscellaneous', 'Undefined']);
/** Anything else (cancelled, postponed, rescheduled) is not something to send a guest to. */
const SHOWABLE_STATUS = new Set(['onsale', 'offsale']);


interface TicketmasterImage {
  url: string;
  ratio?: string;
  width?: number;
  height?: number;
  fallback?: boolean;
}

interface TicketmasterClassification {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
}

interface TicketmasterVenue {
  name?: string;
  city?: { name?: string };
  address?: { line1?: string };
  location?: { latitude?: string; longitude?: string };
}

interface TicketmasterEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  images?: TicketmasterImage[];
  classifications?: TicketmasterClassification[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  dates?: {
    start?: { dateTime?: string; localDate?: string; localTime?: string; dateTBA?: boolean; timeTBA?: boolean; noSpecificTime?: boolean };
    status?: { code?: string };
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: { name?: string }[];
  };
}

interface DiscoveryResponse {
  _embedded?: { events?: TicketmasterEvent[] };
  page?: { totalPages?: number; number?: number };
}

interface EventRow {
  id: string;
  city: string;
  starts_at: string;
  name: string;
  time_label: string;
  price_label: string;
  travel: string;
  vibe_tags: string[];
  cats: string[];
  date_label: string;
  venue: string;
  venue_id: string | null;
  addr: string;
  lineup: string;
  know: string;
  price_from: string;
  all_in: string;
  ticketed: boolean;
  ticket_url: string;
  ticket_provider: string;
  source_url: string;
  verified_label: string;
  image: string;
  source: 'ticketmaster';
  updated_at: string;
}

// ── Discovery API ──

async function fetchPage(page: number, startISO: string, endISO: string, city: City): Promise<DiscoveryResponse> {
  const params = new URLSearchParams({
    apikey: API_KEY as string,
    latlong: `${city.anchor.latitude},${city.anchor.longitude}`,
    radius: String(RADIUS_MILES),
    unit: 'miles',
    startDateTime: startISO,
    endDateTime: endISO,
    size: String(PAGE_SIZE),
    page: String(page),
    sort: 'date,asc',
    locale: '*',
  });
  const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
  if (!response.ok) {
    throw new Error(`Discovery API ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return (await response.json()) as DiscoveryResponse;
}

/** Discovery wants a UTC instant with a literal Z and no milliseconds. */
function discoveryTimestamp(date: Date): string {
  return `${date.toISOString().split('.')[0]}Z`;
}

// ── Honesty filters ──

/** Ticketmaster marks its own generic stand-in art with fallback:true. Those are
 * stock images, not the show's own art, so they fail the image policy in DATA.md —
 * an event without real art is dropped rather than shipped with a placeholder. */
function pickImage(event: TicketmasterEvent): string | null {
  const usable = (event.images ?? []).filter((image) => image.url?.startsWith('https://') && !image.fallback);
  if (!usable.length) return null;
  const wide = usable.filter((image) => image.ratio === '16_9');
  const pool = wide.length ? wide : usable;
  return pool.reduce((best, image) => ((image.width ?? 0) > (best.width ?? 0) ? image : best)).url;
}

function isShowable(event: TicketmasterEvent): boolean {
  if (!event.id || !event.name || !event.url) return false;
  if (JUNK_TITLE.test(event.name)) return false;
  if (!SHOWABLE_STATUS.has(event.dates?.status?.code ?? '')) return false;
  // No confirmed clock time means "right now" (principle 3) can't be honest about it.
  if (event.dates?.start?.dateTBA || event.dates?.start?.timeTBA || event.dates?.start?.noSpecificTime) return false;
  if (!event.dates?.start?.dateTime) return false;
  const segment = event.classifications?.[0]?.segment?.name ?? '';
  if (JUNK_SEGMENTS.has(segment)) return false;
  const venue = event._embedded?.venues?.[0];
  if (!venue?.name || !venue.address?.line1) return false;
  if (!venue.location?.latitude || !venue.location?.longitude) return false;
  return Boolean(pickImage(event));
}

// ── Mapping to the ScoperEvent row shape ──

function venueCoords(venue: TicketmasterVenue): GeoPoint {
  return {
    latitude: Number(venue.location?.latitude),
    longitude: Number(venue.location?.longitude),
  };
}

/** Distance from the downtown anchor, computed from Ticketmaster's own venue
 * coordinates. Real measurement, not a guessed walk time. */
function travelLabel(venue: TicketmasterVenue, city: City): string {
  const miles = milesBetween(city.anchor, venueCoords(venue));
  return miles < 0.1 ? 'Right here' : `${formatMiles(miles)} from Downtown`;
}

function categories(startsAt: Date, event: TicketmasterEvent, now: Date, city: City): string[] {
  const cats: string[] = [];
  const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: city.timezone });
  cats.push(dayKey(startsAt) === dayKey(now) ? 'Tonight' : 'Upcoming');

  const segment = event.classifications?.[0]?.segment?.name ?? '';
  const genre = event.classifications?.[0]?.genre?.name ?? '';
  if (segment === 'Music') cats.push('Live music');
  if (segment === 'Film' || genre === 'Film') cats.push('Movies');
  return cats;
}

/** Only Ticketmaster's own classification values — no invented vibe copy. */
function vibeTags(event: TicketmasterEvent): string[] {
  const classification = event.classifications?.[0];
  const raw = [classification?.genre?.name, classification?.subGenre?.name, classification?.segment?.name];
  const tags: string[] = [];
  for (const value of raw) {
    if (!value || value === 'Undefined' || value === 'Other') continue;
    if (!tags.includes(value)) tags.push(value);
  }
  return tags.slice(0, 3);
}

function priceLabels(event: TicketmasterEvent): { label: string; from: string; allIn: string } {
  const range = event.priceRanges?.[0];
  const min = range?.min;
  const max = range?.max;
  if (min == null) return { label: 'See tickets', from: 'See tickets', allIn: 'See official listing' };
  const symbol = !range?.currency || range.currency === 'USD' ? '$' : `${range.currency} `;
  const from = `${symbol}${Math.round(min)}`;
  const allIn = max != null && Math.round(max) !== Math.round(min) ? `${from}–${symbol}${Math.round(max)}` : from;
  return { label: from, from, allIn };
}

function timeLabels(startsAt: Date, city: City): { time: string; date: string } {
  const time = startsAt.toLocaleTimeString('en-US', { timeZone: city.timezone, hour: 'numeric', minute: '2-digit' });
  const trimmed = time.replace(':00', '');
  const day = startsAt.toLocaleDateString('en-US', { timeZone: city.timezone, weekday: 'short', month: 'short', day: 'numeric' });
  return { time: trimmed, date: `${day} · ${trimmed}` };
}

function toRow(event: TicketmasterEvent, now: Date, pulledLabel: string, city: City): EventRow {
  const venue = event._embedded?.venues?.[0] as TicketmasterVenue;
  const startsAt = new Date(event.dates?.start?.dateTime as string);
  const { time, date } = timeLabels(startsAt, city);
  const price = priceLabels(event);
  const attractions = (event._embedded?.attractions ?? []).map((a) => a.name).filter(Boolean) as string[];

  return {
    id: `tm_${event.id}`,
    starts_at: startsAt.toISOString(),
    name: event.name,
    time_label: time,
    price_label: price.label,
    travel: travelLabel(venue, city),
    vibe_tags: vibeTags(event),
    cats: categories(startsAt, event, now, city),
    date_label: date,
    venue: venue.name as string,
    venue_id: VENUE_IDS[venue.name as string] ?? null,
    addr: `${venue.address?.line1} · ${travelLabel(venue, city)}`,
    lineup: attractions.length ? attractions.join(' · ') : 'Lineup is on the Ticketmaster listing',
    // Ticketmaster's own copy where it exists; otherwise a plain pointer rather
    // than invented description text (DATA.md honesty rules).
    know: event.info?.trim() || event.pleaseNote?.trim() || 'Full details, age policy, and door times are on the Ticketmaster listing.',
    price_from: price.from,
    all_in: price.allIn,
    ticketed: true,
    ticket_url: event.url as string,
    ticket_provider: 'Ticketmaster',
    source_url: event.url as string,
    verified_label: pulledLabel,
    image: pickImage(event) as string,
    source: 'ticketmaster',
    city: city.slug,
    updated_at: new Date().toISOString(),
  };
}

// ── Dedupe against the curated bundle ──

function normalizeVenue(name: string): string {
  return name.toLowerCase().replace(/[’']/g, '').replace(/\b(the|theater|theatre|club|oakland)\b/g, '').replace(/[^a-z0-9]/g, '');
}

const COLLISION_WINDOW_MS = 90 * 60 * 1000;

/** A hand-verified curated entry always wins: it carries a real verifiedLabel and
 * editorial copy, so shipping the Ticketmaster twin alongside it would be the
 * duplicate-listing spam principle 4 exists to prevent. */
function collidesWithCurated(row: EventRow): boolean {
  const rowVenue = normalizeVenue(row.venue);
  const rowStart = new Date(row.starts_at).getTime();
  return Object.values(EVENTS).some((curated) => {
    if (!curated.startsAt) return false;
    const sameVenue = row.venue_id && curated.venueId
      ? row.venue_id === curated.venueId
      : normalizeVenue(curated.venue) === rowVenue;
    if (!sameVenue) return false;
    return Math.abs(new Date(curated.startsAt).getTime() - rowStart) < COLLISION_WINDOW_MS;
  });
}

// ── Main ──

/** `client` is null only under TICKETMASTER_DRY_RUN=1, which stops before any
 * write. A missing key throws rather than exiting so the failure is recorded in
 * sync_runs on a real run (see scripts/lib/sync-run.ts). */
async function main(client: SupabaseClient | null, city: City): Promise<SyncOutcome> {
  if (!API_KEY) throw new Error('TICKETMASTER_API_KEY is not set');

  const now = new Date();
  const end = new Date(now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  const pulledLabel = `Listed on Ticketmaster — pulled ${now.toLocaleDateString('en-US', { timeZone: city.timezone, month: 'short', day: 'numeric', year: 'numeric' })}`;

  const raw: TicketmasterEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await fetchPage(page, discoveryTimestamp(now), discoveryTimestamp(end), city);
    const events = body._embedded?.events ?? [];
    raw.push(...events);
    const totalPages = body.page?.totalPages ?? 1;
    if (events.length < PAGE_SIZE || page + 1 >= totalPages) break;
  }

  const showable = raw.filter(isShowable);
  const seenTicketmasterIds = new Set<string>();
  const perVenue = new Map<string, number>();
  const rows: EventRow[] = [];
  let collisions = 0;

  for (const event of showable) {
    if (seenTicketmasterIds.has(event.id)) continue;
    seenTicketmasterIds.add(event.id);

    const row = toRow(event, now, pulledLabel, city);
    if (collidesWithCurated(row)) {
      collisions += 1;
      continue;
    }
    const venueKey = row.venue_id ?? normalizeVenue(row.venue);
    const count = perVenue.get(venueKey) ?? 0;
    if (count >= MAX_PER_VENUE) continue;
    perVenue.set(venueKey, count + 1);

    rows.push(row);
    if (rows.length >= MAX_TOTAL) break;
  }

  console.log(`fetched ${raw.length} · showable ${showable.length} · curated collisions skipped ${collisions} · keeping ${rows.length}`);

  if (DRY_RUN || !client) {
    for (const row of rows) console.log(`  ${row.date_label} · ${row.venue} · ${row.name} · ${row.price_label} · ${row.travel}`);
    console.log('dry run — nothing written');
    return { status: 'ok', rowsWritten: 0, detail: 'dry run' };
  }

  if (rows.length) {
    const { error: upsertError } = await client.from('events').upsert(rows);
    if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);
  }

  // Prune is scoped to source='ticketmaster' so curated rows are never touched
  // (sync-events.ts owns those), and to this city so another city's listings
  // are not swept up for the crime of not being in this run's id list.
  const ids = rows.map((row) => row.id);
  const prune = client
    .from('events')
    .delete({ count: 'exact' })
    .eq('source', 'ticketmaster')
    .eq('city', city.slug);
  const { error: pruneError, count } = ids.length
    ? await prune.not('id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`)
    : await prune;
  if (pruneError) console.error('prune warning:', pruneError.message);

  console.log(`  synced ${rows.length} Ticketmaster events to the backend`);

  // Ticketmaster genuinely has quiet windows, so zero rows is not a failure —
  // but it is worth flagging, since it looks identical to a broken filter.
  return {
    status: pruneError ? 'partial' : 'ok',
    rowsWritten: rows.length,
    rowsPruned: count ?? 0,
    detail: pruneError
      ? `prune warning: ${pruneError.message}`
      : `${raw.length} fetched, ${collisions} curated collisions skipped`,
  };
}

if (DRY_RUN) {
  void main(null, DRY_RUN_CITY).catch((error: unknown) => {
    console.error('ticketmaster dry run failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
} else {
  const client = serviceClient('sync Ticketmaster events (or set TICKETMASTER_DRY_RUN=1)');
  void withCitySyncRuns(client, 'ticketmaster', (city) => main(client, city));
}
