// Runtime hydration for Viator affiliate picks — mirrors events-remote.ts.
// Populated by scripts/sync-viator.ts (server-side, holds the API key).
// The client never talks to Viator directly; it just reads this table.
import { useSyncExternalStore } from 'react';

import { activeCity, cityCacheKey } from '@/lib/city';
import { getStoredItem, setStoredItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export interface ViatorPick {
  id: string;
  title: string;
  description: string;
  image: string;
  priceFrom: number | null;
  currency: string | null;
  durationLabel: string | null;
  rating: number | null;
  reviewCount: number | null;
  destination: string;
  bookingUrl: string;
  freeCancellation: boolean | null;
  flags: string[];
  inclusions: string[];
  availabilityDates: string[];
}

interface ViatorPickRow {
  id: string;
  title: string;
  description: string;
  image: string;
  price_from: number | null;
  currency: string | null;
  duration_label: string | null;
  rating: number | null;
  review_count: number | null;
  destination: string;
  booking_url: string;
  free_cancellation: boolean | null;
  flags: string[] | null;
  inclusions: string[] | null;
  availability_dates: string[] | null;
}

function rowToPick(row: ViatorPickRow): ViatorPick {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image,
    priceFrom: row.price_from,
    currency: row.currency,
    durationLabel: row.duration_label,
    rating: row.rating,
    reviewCount: row.review_count,
    destination: row.destination,
    bookingUrl: row.booking_url,
    freeCancellation: row.free_cancellation,
    flags: row.flags ?? [],
    inclusions: row.inclusions ?? [],
    availabilityDates: row.availability_dates ?? [],
  };
}

/** Known Viator product flags this app can honestly label — anything else from
 * the API is stored but not shown, rather than guessing at a display name. */
const FLAG_LABELS: Record<string, string> = {
  PRIVATE_TOUR: 'Private tour',
  SKIP_THE_LINE: 'Skip the line',
  LIKELY_TO_SELL_OUT: 'Likely to sell out',
  SPECIAL_OFFER: 'Special offer',
};

export function viatorFlagLabels(pick: ViatorPick): string[] {
  return pick.flags.map((flag) => FLAG_LABELS[flag]).filter((label): label is string => !!label);
}

/** Single most compelling real signal for a pick's poster chip — Viator's own
 * flags first (they're the honest source for urgency claims like "selling
 * fast"), then rating/review-count thresholds high enough to actually mean
 * something. Returns null rather than inventing a label when nothing qualifies. */
export function viatorHighlightChip(pick: ViatorPick): string | null {
  if (pick.flags.includes('LIKELY_TO_SELL_OUT')) return 'Selling fast';
  if (pick.flags.includes('SPECIAL_OFFER')) return 'Special offer';
  if (pick.rating != null && pick.rating >= 4.7 && (pick.reviewCount ?? 0) >= 50) return 'Highly rated';
  if ((pick.reviewCount ?? 0) >= 200) return 'Popular pick';
  if (pick.freeCancellation) return 'Free cancellation';
  if (pick.flags.includes('PRIVATE_TOUR')) return 'Private tour';
  if (pick.flags.includes('SKIP_THE_LINE')) return 'Skip the line';
  return null;
}

/** Starting total for N guests, from Viator's real per-traveler "from" price — an
 * honest estimate, not a locked quote (exact totals are confirmed on viator.com). */
export function viatorTotalLabel(pick: ViatorPick, guests: number): string | null {
  if (pick.priceFrom == null) return null;
  const currency = pick.currency === 'USD' || !pick.currency ? '$' : `${pick.currency} `;
  return `From ${currency}${Math.round(pick.priceFrom * guests)}`;
}

/** "Thu 23" from an ISO date string, for date-chip labels. */
export function formatDateChip(iso: string): { weekday: string; day: string } {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: String(date.getUTCDate()),
  };
}

/** Real, honest price line — e.g. "From $74" — or null when Viator didn't return a price. */
export function viatorPriceLabel(pick: ViatorPick): string | null {
  if (pick.priceFrom == null) return null;
  const currency = pick.currency === 'USD' || !pick.currency ? '$' : `${pick.currency} `;
  return `From ${currency}${Math.round(pick.priceFrom)}`;
}

/** Relevance to a Downtown Oakland guest — closest first. Matches DESTINATION_QUERIES in scripts/sync-viator.ts. */
export const DESTINATION_PRIORITY = ['Oakland & East Bay', 'San Francisco', 'Napa', 'Yosemite'] as const;

/** Picks ordered Oakland & East Bay → San Francisco → Napa → Yosemite, then by rating within each. Unknown destinations sort last. */
export function sortedViatorPicks(picks: ViatorPick[] = Object.values(VIATOR_PICKS)): ViatorPick[] {
  const rank = (destination: string) => {
    const index = DESTINATION_PRIORITY.indexOf(destination as (typeof DESTINATION_PRIORITY)[number]);
    return index === -1 ? DESTINATION_PRIORITY.length : index;
  };
  return [...picks].sort((a, b) => {
    const destinationDiff = rank(a.destination) - rank(b.destination);
    if (destinationDiff !== 0) return destinationDiff;
    return popularityScore(b) - popularityScore(a);
  });
}

/** Weighs rating by how many people actually reviewed it, so a 5.0 from one review
 * doesn't outrank a 4.6 from thousands — a closer proxy for "what people click on and
 * buy" than a raw star average. */
function popularityScore(pick: ViatorPick): number {
  return (pick.rating ?? 0) * Math.log10((pick.reviewCount ?? 0) + 10);
}

export const VIATOR_PICKS: Record<string, ViatorPick> = {};

// Which city the current contents describe. Null means nothing has loaded yet;
// a different slug means the guest changed city and what is held belongs to the
// city they left.
let hydratedCity: string | null = null;

// Last-known-good snapshot for offline cold launches — same fallback pattern
// as places.ts. Never a substitute for a successful fetch, only a fallback
// for when one hasn't happened yet.
const CACHE_BASE = 'wayvee.viatorPicks.cache.v1';

async function loadPicksFromCache(): Promise<void> {
  const raw = await getStoredItem(cityCacheKey(CACHE_BASE));
  if (!raw) return;
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows) || !rows.length) return;
    for (const pick of rows as ViatorPick[]) {
      if (!pick?.id || !pick.title || !pick.image || !pick.bookingUrl) continue;
      VIATOR_PICKS[pick.id] = pick;
    }
    notify();
  } catch {
    // Corrupt cache — ignore, the next successful network fetch overwrites it.
  }
}

function savePicksToCache(): void {
  void setStoredItem(cityCacheKey(CACHE_BASE), JSON.stringify(Object.values(VIATOR_PICKS))).catch(() => {});
}

// Whichever screen happens to be mounted when the Supabase fetch below resolves
// used to just miss the update — VIATOR_PICKS is a plain mutable object, and
// mutating it doesn't trigger React re-renders on its own. This tiny store lets
// every consumer (Home, the picks list, a deep-linked pick detail page) subscribe
// and re-render the moment real rows land, regardless of mount order/timing.
type Listener = () => void;
const listeners = new Set<Listener>();
let picksSnapshot: ViatorPick[] = [];

function notify() {
  picksSnapshot = Object.values(VIATOR_PICKS);
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ViatorPick[] {
  return picksSnapshot;
}

/** Reactive read of every hydrated Viator pick — re-renders the caller once real rows land. */
export function useViatorPicks(): ViatorPick[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Fetch backend-synced Viator picks. Returns true when fresh rows landed.
 * Pass force=true (pull-to-refresh) to bypass the one-shot cache and refetch. */
export async function hydrateViatorPicksFromBackend(force = false): Promise<boolean> {
  const city = activeCity();
  const hydrated = hydratedCity === city;
  if (hydrated && !force) return false;
  if (hydratedCity !== null && !hydrated) {
    for (const id of Object.keys(VIATOR_PICKS)) delete VIATOR_PICKS[id];
  }
  if (!supabase) {
    if (!hydrated) await loadPicksFromCache();
    return false;
  }
  try {
    const { data, error } = await supabase.from('viator_picks').select('*').eq('city', city);
    if (error || !data?.length) {
      if (!hydrated) await loadPicksFromCache();
      return false;
    }
    for (const row of data as unknown as ViatorPickRow[]) {
      if (!row?.id || !row.title || !row.image || !row.booking_url) continue;
      VIATOR_PICKS[row.id] = rowToPick(row);
    }
    hydratedCity = city;
    notify();
    savePicksToCache();
    return true;
  } catch {
    if (!hydrated) await loadPicksFromCache();
    return false;
  }
}
