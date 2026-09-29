// Runtime event hydration: overlays backend rows onto the bundled snapshot.
// The bundle is the offline/first-paint fallback; the backend, when reachable,
// is the fresher source (see DATA.md). Rows are merged by id — bundled events
// missing from the backend survive, so a partial table can never blank the app.
import { EVENTS, type EventCategory, type EventSource, type ScoperEvent } from '@/lib/events';
import { getStoredItem, setStoredItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

interface EventRow {
  id: string;
  starts_at: string;
  name: string;
  time_label: string;
  price_label: string;
  travel: string;
  vibe_tags: string[] | null;
  cats: string[] | null;
  date_label: string;
  venue: string;
  venue_id: string | null;
  addr: string;
  lineup: string;
  know: string;
  price_from: string;
  all_in: string;
  ticketed: boolean;
  ticket_url: string | null;
  ticket_provider: string | null;
  source_url: string;
  verified_label: string;
  image: string;
  source: string | null;
}

function rowToEvent(row: EventRow): ScoperEvent {
  return {
    id: row.id,
    startsAt: row.starts_at,
    name: row.name,
    time: row.time_label,
    priceLabel: row.price_label,
    travel: row.travel,
    vibeTags: row.vibe_tags ?? undefined,
    cats: (row.cats ?? []) as EventCategory[],
    date: row.date_label,
    venue: row.venue,
    venueId: row.venue_id ?? undefined,
    addr: row.addr,
    lineup: row.lineup,
    know: row.know,
    priceFrom: row.price_from,
    allIn: row.all_in,
    ticketed: row.ticketed,
    ticketUrl: row.ticket_url ?? undefined,
    ticketProvider: row.ticket_provider ?? undefined,
    sourceUrl: row.source_url,
    verifiedLabel: row.verified_label,
    image: row.image,
    source: row.source === 'ticketmaster' ? 'ticketmaster' : ('curated' as EventSource),
  };
}

let hydrated = false;

// Last-known-good snapshot for offline cold launches — same fallback pattern
// as places.ts/viator.ts. The static bundle in events.ts is already a
// same-day-ish fallback, but a cached backend snapshot (fetched some earlier
// session, before the device went offline) is typically fresher than it, so
// it's still worth restoring over the bundle when the network is unreachable.
const CACHE_KEY = 'wayvee.events.cache.v1';

async function loadEventsFromCache(): Promise<boolean> {
  const raw = await getStoredItem(CACHE_KEY);
  if (!raw) return false;
  try {
    const rows = JSON.parse(raw) as unknown;
    if (!Array.isArray(rows) || !rows.length) return false;
    let changed = false;
    for (const event of rows as ScoperEvent[]) {
      if (!event?.id || !event.startsAt || !event.name || !event.image || !event.sourceUrl) continue;
      EVENTS[event.id] = event;
      changed = true;
    }
    return changed;
  } catch {
    return false;
  }
}

function saveEventsToCache(): void {
  void setStoredItem(CACHE_KEY, JSON.stringify(Object.values(EVENTS))).catch(() => {});
}

/** Fetch backend events and merge them into the bundled EVENTS record. Returns
 * true when EVENTS changed — from a fresh network fetch, or (offline) from a
 * cached snapshot of a previous fetch — so callers know whether to re-render.
 * Pass force=true (pull-to-refresh) to bypass the one-shot cache and refetch. */
export async function hydrateEventsFromBackend(force = false): Promise<boolean> {
  if (hydrated && !force) return false;
  if (!supabase) return hydrated ? false : loadEventsFromCache();
  try {
    const { data, error } = await supabase.from('events').select('*');
    if (error || !data?.length) return hydrated ? false : loadEventsFromCache();
    for (const row of data as unknown as EventRow[]) {
      if (!row?.id || !row.starts_at || !row.name || !row.image || !row.source_url) continue;
      EVENTS[row.id] = rowToEvent(row);
    }
    hydrated = true;
    saveEventsToCache();
    return true;
  } catch {
    return hydrated ? false : loadEventsFromCache();
  }
}
