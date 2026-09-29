// Pushes the bundled events snapshot to the Supabase events table and prunes
// rows that no longer exist in the snapshot. Part of the daily refresh
// (see DATA.md): edit src/lib/events.ts, audit, then run this to populate
// the backend without waiting for a redeploy.
//
// Requires env: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and
// SUPABASE_SERVICE_ROLE_KEY (never checked in, never shipped to the client).
import { EVENTS } from '../src/lib/events';
import { withSyncRun, serviceClient, type SyncOutcome } from './lib/sync-run';

// The curated bundle in src/lib/events.ts is Oakland's, so this sync writes
// Oakland rows and prunes only Oakland's curated rows. It is the one sync
// that is not per-city: there is one bundle, not one per city. A second
// city's curated calendar would be a second bundle and a second slug here.
const BUNDLE_CITY = 'oakland';

const client = serviceClient('sync events');

void withSyncRun(
  client,
  'events',
  async (): Promise<SyncOutcome> => {
    const rows = Object.values(EVENTS).map((event) => ({
      id: event.id,
      starts_at: event.startsAt,
      name: event.name,
      time_label: event.time,
      price_label: event.priceLabel,
      travel: event.travel,
      vibe_tags: event.vibeTags ?? [],
      cats: event.cats,
      date_label: event.date,
      venue: event.venue,
      venue_id: event.venueId ?? null,
      addr: event.addr,
      lineup: event.lineup,
      know: event.know,
      price_from: event.priceFrom,
      all_in: event.allIn,
      ticketed: event.ticketed,
      ticket_url: event.ticketUrl ?? null,
      ticket_provider: event.ticketProvider ?? null,
      source_url: event.sourceUrl,
      verified_label: event.verifiedLabel,
      image: event.image,
      source: 'curated',
      city: BUNDLE_CITY,
      updated_at: new Date().toISOString(),
    }));

    // An empty snapshot would build `not('id','in','()')`, which PostgREST
    // rejects — and, if it didn't, the prune below would wipe every curated row
    // on the strength of a bundle that failed to load. Refuse instead.
    if (!rows.length) throw new Error('events bundle is empty — refusing to sync (this would prune every curated row)');

    const { error: upsertError } = await client.from('events').upsert(rows);
    if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);

    // Prune is scoped to source='curated' so it only removes rows this script
    // owns. Ticketmaster rows (see scripts/sync-ticketmaster.ts) are pruned by
    // that script instead — an unscoped delete here would wipe them on every run.
    // It is scoped to the bundle's city for the same reason: another city's
    // curated rows are not this bundle's to delete.
    const ids = rows.map((row) => row.id);
    const { error: pruneError, count } = await client
      .from('events')
      .delete({ count: 'exact' })
      .eq('source', 'curated')
      .eq('city', BUNDLE_CITY)
      .not('id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`);
    if (pruneError) console.error('prune warning:', pruneError.message);

    console.log(`synced ${rows.length} events to the backend`);

    return {
      status: pruneError ? 'partial' : 'ok',
      rowsWritten: rows.length,
      rowsPruned: count ?? 0,
      detail: pruneError ? `prune warning: ${pruneError.message}` : undefined,
    };
  },
  BUNDLE_CITY,
);
