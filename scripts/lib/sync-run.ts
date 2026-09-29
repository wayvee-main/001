// Shared run recorder for every backend-populating sync script.
//
// Each script wraps its main() in withSyncRun(), which writes one row to
// public.sync_runs (see supabase/migrations/20260929000000_wayvee_initial.sql)
// describing what happened: rows written, rows pruned, how long it took, and
// whether the run was clean, degraded, or dead. That row is what makes a silent
// failure visible — a scheduled sync that stops working now shows up as a
// stale/failed status instead of just producing fewer listings.
//
// Recording is always best-effort: a failure to write the audit row must never
// change the exit code of the sync itself, or observability would become a new
// way for the pipeline to break (CLAUDE.md #6).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { launchedCities, type City } from './cities';

export type SyncJob = 'events' | 'ticketmaster' | 'viator' | 'places' | 'weather';
export type SyncStatus = 'ok' | 'partial' | 'failed';

/** What a sync run reports about itself. `partial` means the run wrote real
 * rows but knowingly fell short — one source of two failed, an optional
 * enrichment call errored — so it reads differently from a clean run without
 * pretending it failed outright. */
export interface SyncOutcome {
  status: SyncStatus;
  rowsWritten?: number;
  rowsPruned?: number;
  /** Short human summary, or a truncated error message. Never a raw dump, and
   * never anything secret — public.sync_runs is world-readable by design. */
  detail?: string;
}

const DETAIL_MAX = 500;
const RETENTION_DAYS = 90;

/** Service-role client shared by the sync scripts. Exits with a clear message
 * rather than throwing an opaque error when the environment is not set up. */
export function serviceClient(usage: string): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(`Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to ${usage}.`);
    process.exit(1);
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function recordSyncRun(
  client: SupabaseClient,
  job: SyncJob,
  startedAt: Date,
  outcome: SyncOutcome,
  city: string | null,
): Promise<void> {
  const finishedAt = new Date();
  const { error } = await client.from('sync_runs').insert({
    job,
    city,
    status: outcome.status,
    rows_written: outcome.rowsWritten ?? 0,
    rows_pruned: outcome.rowsPruned ?? 0,
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    detail: outcome.detail ? outcome.detail.slice(0, DETAIL_MAX) : null,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
  });
  if (error) {
    // Non-fatal on purpose — see the header note.
    console.warn(`sync_runs write skipped (${job}):`, error.message);
    return;
  }

  const cutoff = new Date(finishedAt.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let retention = client.from('sync_runs').delete().eq('job', job).lt('finished_at', cutoff);
  retention = city ? retention.eq('city', city) : retention.is('city', null);
  const { error: pruneError } = await retention;
  if (pruneError) console.warn(`sync_runs retention prune skipped (${job}):`, pruneError.message);
}

/** Runs a sync body, records its outcome, and exits non-zero if it failed.
 *
 * A thrown error is recorded as `failed` with its message before the process
 * exits 1, so a crashed run is just as visible as a clean one. Scripts that
 * call process.exit() directly on an unrecoverable error bypass this — prefer
 * throwing so the run gets recorded. */
export async function withSyncRun(
  client: SupabaseClient,
  job: SyncJob,
  body: () => Promise<SyncOutcome>,
  city: string | null = null,
): Promise<void> {
  const startedAt = new Date();
  try {
    const outcome = await body();
    await recordSyncRun(client, job, startedAt, outcome, city);
    if (outcome.status === 'failed') process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${job} sync failed:`, message);
    await recordSyncRun(client, job, startedAt, { status: 'failed', detail: message }, city);
    process.exit(1);
  }
}

/** Runs a sync once per launched city, recording a sync_runs row for each.
 *
 * One city failing does not stop the others: a Ticketmaster outage in San
 * Francisco should not cost Oakland its nightly refresh. Every city is
 * attempted, each result is recorded against that city so sync_status shows
 * exactly which one is stale, and the process exits non-zero at the end if
 * any of them failed. */
export async function withCitySyncRuns(
  client: SupabaseClient,
  job: SyncJob,
  body: (city: City) => Promise<SyncOutcome>,
): Promise<void> {
  let cities: City[];
  try {
    cities = await launchedCities(client);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${job} sync failed:`, message);
    await recordSyncRun(client, job, new Date(), { status: 'failed', detail: message }, null);
    process.exit(1);
  }

  let failed = 0;
  for (const city of cities) {
    const startedAt = new Date();
    console.log(`\n[${city.slug}] ${job}`);
    try {
      const outcome = await body(city);
      await recordSyncRun(client, job, startedAt, outcome, city.slug);
      if (outcome.status === 'failed') failed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${city.slug}] ${job} sync failed:`, message);
      await recordSyncRun(client, job, startedAt, { status: 'failed', detail: message }, city.slug);
      failed += 1;
    }
  }

  if (failed) {
    console.error(`${job}: ${failed} of ${cities.length} cities failed`);
    process.exit(1);
  }
}
