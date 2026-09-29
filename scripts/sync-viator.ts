// Pulls real Viator affiliate inventory for Oakland & the East Bay/San
// Francisco/Napa/Yosemite and pushes it to the viator_picks table — same
// "sync script writes, client just reads" pattern as sync-events.ts.
//
// Booking always happens on viator.com (real handoff, nothing faked
// in-app), so every row's booking_url carries the affiliate tracking
// params required for commission attribution: pid + mcid (+ campaign).
//
// Requires env:
//   VIATOR_API_KEY            — partner API key, never checked in
//   VIATOR_PID                — e.g. p00311090 (safe to commit — it's
//                                meant to sit in public URLs — but kept
//                                as an env var so it's changeable without
//                                a code edit)
//   VIATOR_MCID                — from the Link Creator tool at
//                                partner.viator.com (see docs/how-we-make-money.md)
//   VIATOR_SANDBOX=1           — optional, hits api.sandbox.viator.com instead
//   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// NOTE: field names below follow Viator's documented Partner API
// (docs.viator.com/partner-api) as of this script's writing. Viator's
// exact /destinations and /products/search response shapes should be
// spot-checked against a real response the first time this runs —
// PICK_LIMIT_PER_DESTINATION is intentionally small so that first run is
// cheap to eyeball before trusting it.
import { withSyncRun, serviceClient, type SyncOutcome } from './lib/sync-run';

const API_KEY = process.env.VIATOR_API_KEY;
const PID = process.env.VIATOR_PID || 'p00311090';
const MCID = process.env.VIATOR_MCID;
const SANDBOX = process.env.VIATOR_SANDBOX === '1';
const BASE_URL = SANDBOX ? 'https://api.sandbox.viator.com/partner' : 'https://api.viator.com/partner';

// Ordered by relevance to a Downtown Oakland guest — the client sorts
// Home's carousel by this same order (see DESTINATION_PRIORITY in src/lib/viator.ts).
// Each entry lists exact-match candidates tried in order (no fuzzy/substring
// matching, since that's what previously matched "Napa" to Cyprus's "Ayia Napa")
// — `alsoSearch` is different: those are ADDITIONAL real destinations whose
// results get merged into the same label bucket (used to genuinely widen
// "Oakland" to include Berkeley/East Bay, confirmed live these are two
// distinct Viator destinationIds, not name variants of the same place).
const DESTINATION_QUERIES: { label: string; candidates: string[]; alsoSearch?: string[]; count?: number }[] = [
  // count bumped: excursion filtering (below) drops several of Oakland's own
  // PICKS_PER_DESTINATION results (they're really Yosemite/Napa/Santa Cruz day
  // trips), so a real Oakland-local list needs more raw candidates to filter from.
  { label: 'Oakland & East Bay', candidates: ['Oakland'], alsoSearch: ['Berkeley'], count: 14 },
  { label: 'San Francisco', candidates: ['San Francisco'] },
  { label: 'Napa', candidates: ['Napa & Sonoma', 'Napa Valley', 'Napa'] },
  { label: 'Yosemite', candidates: ['Yosemite National Park', 'Yosemite'] },
];
const PICKS_PER_DESTINATION = 6;

// Confirmed live: Viator's per-destination /products/search results aren't
// "things IN that city" — they include day-trip excursions bookable FROM that
// city (a "Yosemite day trip from Oakland" product genuinely surfaces under
// Oakland's destinationId), and this script used to just stamp every result
// with the query label regardless of what the tour's title actually says.
// That's what put Yosemite/Santa Cruz/Napa trips under "Oakland & East Bay" —
// excluded here for the two close-in buckets only; Napa/Yosemite's own
// buckets are untouched since those trips genuinely belong there.
const EXCURSION_KEYWORDS = ['yosemite', 'santa cruz', 'sonoma', 'monterey', 'carmel', 'sacramento', 'tahoe', 'napa'];
const EXCURSION_FILTERED_LABELS = new Set(['Oakland & East Bay', 'San Francisco']);

function isExcursionTitle(title: string): boolean {
  const value = title.toLowerCase();
  return EXCURSION_KEYWORDS.some((keyword) => value.includes(keyword));
}

// Detail phase: /products/{code} and /availability/schedules/{code} are both
// non-transactional endpoints, so they're available at the Affiliate Partner
// tier this app uses (booking itself stays a redirect to viator.com — that
// part needs the separate Merchant Partner API and isn't what this fetches).
const DETAIL_FETCH_DELAY_MS = 300;
const AVAILABILITY_LOOKAHEAD_DAYS = 21;
const MAX_AVAILABILITY_DATES = 4;

if (!API_KEY) {
  console.error('Set VIATOR_API_KEY to sync Viator picks.');
  process.exit(1);
}
if (!MCID) {
  console.error('Set VIATOR_MCID to sync Viator picks — see docs/how-we-make-money.md for where to find it.');
  process.exit(1);
}
const supabase = serviceClient('sync Viator picks');

async function viatorFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'exp-api-key': API_KEY!,
      Accept: 'application/json;version=2.0',
      'Accept-Language': 'en-US',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

interface ViatorDestination {
  destinationId: number;
  name: string;
  type?: string;
  defaultCurrencyCode?: string;
}

/** Fetches Viator's full destination list once — /destinations returns Viator's whole
 * worldwide taxonomy and is rate-limited more tightly than product endpoints, so this
 * must not be called per-destination (that's what tripped a 429 on the first live run). */
async function fetchAllDestinations(): Promise<ViatorDestination[]> {
  const { destinations } = await viatorFetch<{ destinations: ViatorDestination[] }>('/destinations');
  return destinations;
}

/** Tries each candidate name as an exact (case-insensitive) match — no fuzzy/substring
 * matching, which is how "Napa" previously matched Cyprus's "Ayia Napa" instead of
 * California's Napa. Viator's worldwide list can also have two destinations that share
 * the exact same name — confirmed live: "San Francisco" matches both destinationId 651
 * (the real CITY in California, USD, IATA SFO) and destinationId 51252 (a TOWN in
 * Guanajuato, Mexico, priced in MXN), and .find() was silently trusting whichever came
 * first. Every destination this app queries is in the US, so when a name collides,
 * prefer the USD-priced match and warn loudly either way instead of guessing quietly. */
function resolveDestinationId(destinations: ViatorDestination[], candidates: string[]): { id: number; name: string } | null {
  for (const candidate of candidates) {
    const matches = destinations.filter((d) => d.name.toLowerCase() === candidate.toLowerCase());
    if (matches.length > 1) {
      console.warn(`  ambiguous exact match for "${candidate}" — ${matches.length} destinations share this name:`, JSON.stringify(matches));
    }
    const best = matches.find((d) => d.defaultCurrencyCode === 'USD') ?? matches[0];
    if (best) return { id: best.destinationId, name: best.name };
  }
  return null;
}

interface ViatorProductImage {
  variants?: { url: string; width: number }[];
}

interface ViatorProduct {
  productCode: string;
  title: string;
  description?: string;
  images?: ViatorProductImage[];
  pricing?: { summary?: { fromPrice?: number }; currency?: string };
  duration?: { fixedDurationInMinutes?: number };
  reviews?: { combinedAverageRating?: number; totalReviews?: number };
  productUrl?: string;
  // The real home of LIKELY_TO_SELL_OUT/SPECIAL_OFFER/FREE_CANCELLATION — these live on
  // the /products/search response, not /products/{code} (confirmed after the first pass
  // came back empty for every product; /products/{code} just doesn't carry this field).
  flags?: string[];
}

interface ViatorProductDetails {
  inclusions?: (string | { description?: string; otherDescription?: string })[];
  cancellationPolicy?: { type?: string; description?: string };
  flags?: string[];
}

interface ViatorPricingRecord {
  daysOfWeek?: string[];
  timedEntries?: { unavailableDates?: { date: string; reason?: string }[] }[];
}

interface ViatorAvailabilitySeason {
  startDate?: string;
  endDate?: string;
  pricingRecords?: ViatorPricingRecord[];
}

interface ViatorAvailabilitySchedule {
  bookableItems?: { seasons?: ViatorAvailabilitySeason[] }[];
}

const WEEKDAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Best-effort fetch — detail/availability enrichment is a nice-to-have on top of the
 * base listing, so a failure here (e.g. a product this affiliate tier can't see the
 * detail for) just means that product ships with fewer real fields, not a sync failure. */
async function fetchProductDetails(productCode: string): Promise<ViatorProductDetails | null> {
  try {
    return await viatorFetch<ViatorProductDetails>(`/products/${productCode}`);
  } catch (error) {
    console.warn(`  product details unavailable for ${productCode}:`, (error as Error).message);
    return null;
  }
}

async function fetchAvailabilitySchedule(productCode: string): Promise<ViatorAvailabilitySchedule | null> {
  try {
    return await viatorFetch<ViatorAvailabilitySchedule>(`/availability/schedules/${productCode}`);
  } catch (error) {
    console.warn(`  availability schedule unavailable for ${productCode}:`, (error as Error).message);
    return null;
  }
}

function normalizeInclusions(details: ViatorProductDetails | null): string[] | null {
  const raw = details?.inclusions;
  if (!raw?.length) return null;
  const labels = raw
    .map((item) => (typeof item === 'string' ? item : item.description || item.otherDescription || null))
    .filter((label): label is string => !!label);
  return labels.length ? labels.slice(0, 5) : null;
}

function deriveFreeCancellation(searchFlags: string[], details: ViatorProductDetails | null): boolean | null {
  if (searchFlags.includes('FREE_CANCELLATION')) return true;
  if (details?.flags?.includes('FREE_CANCELLATION')) return true;
  if (details?.cancellationPolicy?.type) return details.cancellationPolicy.type === 'STANDARD';
  return null;
}

/** Merges flags from /products/search (the real source for LIKELY_TO_SELL_OUT/
 * SPECIAL_OFFER) with anything /products/{code} also reports, deduped. */
function mergedFlags(searchFlags: string[], details: ViatorProductDetails | null): string[] | null {
  const all = new Set([...searchFlags, ...(details?.flags ?? [])]);
  return all.size ? [...all] : null;
}

/** Strips duration/group-size words and digits so "6 Hour Wine Tour up to 7 Guests" and
 * "8 Hour Wine Tour up to 7 Guests" collapse to the same family — operators frequently
 * list duration/group-size variants of the same real tour as separate products, which
 * otherwise fills a small per-destination list with near-duplicate entries and near-
 * identical photos. */
function titleFamily(title: string): string {
  return title
    .toLowerCase()
    .replace(/\d+/g, '')
    .replace(/\b(hour|hours|hr|hrs|day|days|guest|guests|people|person|pax)\b/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Walks forward from tomorrow, matching each candidate date's weekday + season against
 * pricingRecords, and excluding anything listed in unavailableDates. No fabricated dates —
 * if Viator's schedule doesn't clearly mark a date bookable, it's left out. */
function computeAvailabilityDates(schedule: ViatorAvailabilitySchedule | null): string[] | null {
  const seasons = schedule?.bookableItems?.[0]?.seasons;
  if (!seasons?.length) return null;

  const dates: string[] = [];
  const today = new Date();

  for (let offset = 1; offset <= AVAILABILITY_LOOKAHEAD_DAYS && dates.length < MAX_AVAILABILITY_DATES; offset += 1) {
    const candidate = new Date(today);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const iso = candidate.toISOString().slice(0, 10);
    const weekday = WEEKDAY_NAMES[candidate.getUTCDay()];

    const season = seasons.find((s) => (!s.startDate || s.startDate <= iso) && (!s.endDate || s.endDate >= iso));
    if (!season) continue;

    const bookable = season.pricingRecords?.some((record) => {
      if (!record.daysOfWeek?.includes(weekday)) return false;
      const blocked = record.timedEntries?.some((entry) => entry.unavailableDates?.some((u) => u.date === iso));
      return !blocked;
    });
    if (bookable) dates.push(iso);
  }

  return dates.length ? dates : null;
}

function largestImageUrl(images?: ViatorProductImage[]): string | null {
  const variants = images?.[0]?.variants ?? [];
  return [...variants].sort((a, b) => b.width - a.width)[0]?.url ?? null;
}

function durationLabel(minutes?: number): string | null {
  if (!minutes) return null;
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} day${minutes >= 2880 ? 's' : ''}`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hours`;
  return `${minutes} min`;
}

function trackedBookingUrl(productUrl: string): string {
  const url = new URL(productUrl);
  url.searchParams.set('pid', PID);
  url.searchParams.set('mcid', MCID!);
  url.searchParams.set('medium', 'link');
  url.searchParams.set('campaign', 'wayvee-picks-for-your-stay');
  return url.toString();
}

async function searchProducts(destinationId: number, count: number): Promise<ViatorProduct[]> {
  const { products } = await viatorFetch<{ products: ViatorProduct[] }>('/products/search', {
    method: 'POST',
    body: JSON.stringify({
      filtering: { destination: String(destinationId) },
      // DEFAULT is Viator's own "featured" ranking — their real conversion/booking
      // signal, closer to "what people actually click on and buy" than sorting by raw
      // star rating alone (which lets a 5.0 from two reviews outrank a 4.6 from 5,000).
      sorting: { sort: 'DEFAULT' },
      pagination: { start: 1, count },
      currency: 'USD',
    }),
  });
  return products ?? [];
}

void withSyncRun(supabase, 'viator', async (): Promise<SyncOutcome> => {
  const rows: Record<string, unknown>[] = [];

  const allDestinations = await fetchAllDestinations().catch((error) => {
    console.error('could not fetch the Viator destination list:', error.message);
    return [] as ViatorDestination[];
  });
  if (!allDestinations.length) throw new Error('no destinations fetched — nothing to sync');

  const seenProductCodes = new Set<string>();

  for (const { label, candidates, alsoSearch, count } of DESTINATION_QUERIES) {
    const primary = resolveDestinationId(allDestinations, candidates);
    if (!primary) {
      console.warn(`skipping "${label}" — no matching Viator destination among [${candidates.join(', ')}]`);
      continue;
    }
    const extras: { id: number; name: string }[] = [];
    for (const name of alsoSearch ?? []) {
      const resolved = resolveDestinationId(allDestinations, [name]);
      if (resolved) {
        extras.push(resolved);
        continue;
      }
      console.warn(`  "${label}" alsoSearch: no matching Viator destination for "${name}"`);
      // No exact match — dump anything similarly named so the real spelling/
      // suffix (Viator often needs "X & Y" or "X, State" forms, same as Napa's
      // "Napa & Sonoma") shows up in the Actions log instead of guessing again.
      const near = allDestinations.filter((d) => d.name.toLowerCase().includes(name.toLowerCase()));
      if (near.length) {
        console.warn(`    similarly-named destinations found ->`, JSON.stringify(near.map((d) => ({ id: d.destinationId, name: d.name, type: d.type }))));
      } else {
        console.warn(`    no destination name contains "${name}" at all — Viator may not catalog it separately from its parent region.`);
      }
    }
    const destinations = [primary, ...extras];
    const searchCount = count ?? PICKS_PER_DESTINATION;

    const productsByDestination = await Promise.all(
      destinations.map((destination) =>
        searchProducts(destination.id, searchCount).catch((error) => {
          console.error(`product search failed for "${destination.name}":`, error.message);
          return [] as ViatorProduct[];
        }),
      ),
    );
    const excludeExcursions = EXCURSION_FILTERED_LABELS.has(label);
    const excludedTitles: string[] = [];
    const products = productsByDestination.flat().filter((product) => {
      if (excludeExcursions && isExcursionTitle(product.title)) {
        excludedTitles.push(product.title);
        return false;
      }
      return true;
    });
    if (excludedTitles.length) console.log(`  ${label}: excluded ${excludedTitles.length} excursion-style listing(s) ->`, JSON.stringify(excludedTitles));

    let added = 0;
    const seenTitleFamilies = new Set<string>();
    for (const product of products) {
      const image = largestImageUrl(product.images);
      if (!product.productUrl || !image || !product.description) continue;
      // Same product can surface under more than one destination search — Postgres's
      // upsert can't affect the same row twice in one statement, so keep first-seen only
      // (destinations are iterated in priority order, so that's the more relevant tag anyway).
      if (seenProductCodes.has(product.productCode)) continue;
      const family = titleFamily(product.title);
      if (seenTitleFamilies.has(family)) continue; // near-duplicate duration/group-size variant, already kept one
      seenProductCodes.add(product.productCode);
      seenTitleFamilies.add(family);
      added += 1;

      const [details, schedule] = await Promise.all([
        fetchProductDetails(product.productCode),
        fetchAvailabilitySchedule(product.productCode),
      ]);
      rows.push({
        id: product.productCode,
        title: product.title,
        description: product.description,
        image,
        price_from: product.pricing?.summary?.fromPrice ?? null,
        currency: product.pricing?.currency ?? 'USD',
        duration_label: durationLabel(product.duration?.fixedDurationInMinutes),
        rating: product.reviews?.combinedAverageRating ?? null,
        review_count: product.reviews?.totalReviews ?? null,
        destination: label,
        booking_url: trackedBookingUrl(product.productUrl),
        free_cancellation: deriveFreeCancellation(product.flags ?? [], details),
        flags: mergedFlags(product.flags ?? [], details),
        inclusions: normalizeInclusions(details),
        availability_dates: computeAvailabilityDates(schedule),
        updated_at: new Date().toISOString(),
      });
      await new Promise((resolve) => setTimeout(resolve, DETAIL_FETCH_DELAY_MS));
    }

    console.log(`${label} [${destinations.map((d) => d.name).join(' + ')}]: ${products.length} products after filtering, ${added} new`);
    await new Promise((resolve) => setTimeout(resolve, 400)); // light pacing, cheap insurance against rate limits
  }

  // An empty result would make the prune below wipe the whole table on the
  // strength of a failed fetch — refuse rather than empty the picks carousel.
  if (!rows.length) throw new Error('no Viator picks fetched — nothing written');

  const { error: upsertError } = await supabase.from('viator_picks').upsert(rows);
  if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);

  const ids = rows.map((row) => row.id as string);
  const { error: pruneError, count } = await supabase
    .from('viator_picks')
    .delete({ count: 'exact' })
    .not('id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`);
  if (pruneError) console.error('prune warning:', pruneError.message);

  console.log(`synced ${rows.length} Viator picks to the backend`);

  return {
    status: pruneError ? 'partial' : 'ok',
    rowsWritten: rows.length,
    rowsPruned: count ?? 0,
    detail: pruneError ? `prune warning: ${pruneError.message}` : undefined,
  };
});
