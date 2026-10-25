/** Slow, resumable identity backfill for all nine Bay Area counties. This job
 * never reads launchedCities, writes places, prunes records, or calls an LLM. */
import { serviceClient } from './lib/sync-run';
import {
  REGION, REFRESH_MS, MATCH_MARGIN_DEGREES, SourceBudget, SourceBudgetExhausted,
  SourceRequestError, BatchTooLarge, initialBatches, splitBatch, overpassQuery,
  parsePlaces, dedupePlaces, failureRetryAt, boundedInteger,
  type Batch, type BatchState, type Identity, type OverpassPayload, type RegionalWrite,
} from './lib/regional-places';

const client = serviceClient('collect regional places');
const sourceLimit = boundedInteger(process.env.REGIONAL_SOURCE_REQUEST_LIMIT, 6, 12);
const batchLimit = boundedInteger(process.env.REGIONAL_BATCH_LIMIT, 6, 12);
const source = new SourceBudget(sourceLimit);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** An HTTP 429 or long Retry-After ends this run; the durable batch backoff
 * retries later. No mirror hopping or burst of requests around rate limits. */
async function fetchBatch(batch: Batch): Promise<OverpassPayload> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await source.read(overpassQuery(batch)); }
    catch (error) {
      if (error instanceof BatchTooLarge || error instanceof SourceBudgetExhausted) throw error;
      const retryable = !(error instanceof SourceRequestError) || error.retryable;
      if (!retryable || attempt === 1 || source.requests >= sourceLimit) throw error;
      if (error instanceof SourceRequestError && (error.message === 'Overpass HTTP 429' || error.retryAfterMs > 30_000)) throw error;
      await wait(error instanceof SourceRequestError ? Math.max(15_000, error.retryAfterMs) : 15_000);
    }
  }
  throw new Error('source attempt limit reached');
}

async function identityCandidates(batch: Batch, incoming: RegionalWrite[]): Promise<Identity[]> {
  const candidates: Identity[] = [];
  const p_bounds = {
    min_lat: batch.min_lat - MATCH_MARGIN_DEGREES, min_lon: batch.min_lon - MATCH_MARGIN_DEGREES,
    max_lat: batch.max_lat + MATCH_MARGIN_DEGREES, max_lon: batch.max_lon + MATCH_MARGIN_DEGREES,
  };
  const p_source_ids = incoming.flatMap(place => place.source_osm_ids);
  for (let offset = 0; offset <= 10_000; offset += 1000) {
    const { data, error } = await client.rpc('regional_identity_candidates', { p_bounds, p_source_ids, p_offset: offset });
    if (error) throw new Error(`regional candidate lookup: ${error.message}`);
    candidates.push(...(data || []) as Identity[]);
    if (!data || data.length < 1000) return candidates;
  }
  throw new BatchTooLarge('candidate tile exceeds pagination cap');
}

async function writePlaces(rows: RegionalWrite[]): Promise<number> {
  let written = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { data, error } = await client.rpc('upsert_regional_places', { p_rows: rows.slice(offset, offset + 500) });
    if (error) throw new Error(`regional identity upsert: ${error.message}`);
    written += Number(data || 0);
  }
  return written;
}

async function checkpoint(batch: Batch, fields: Record<string, unknown>): Promise<void> {
  const { error } = await client.from('regional_collection_batches')
    .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', batch.id);
  if (error) throw new Error(`regional checkpoint: ${error.message}`);
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  let written = 0, completed = 0, failed = 0, split = 0, fatal: Error | undefined;
  try {
    const { error: initError } = await client.from('regional_collection_batches')
      .upsert(initialBatches(), { onConflict: 'id', ignoreDuplicates: true });
    if (initError) throw new Error(`regional batch initialization: ${initError.message}`);
    const { data: seeded, error: seedError } = await client.rpc('seed_regional_places_from_catalog');
    if (seedError) throw new Error(`regional catalog seed: ${seedError.message}`);
    written += Number(seeded || 0);
    const { data, error } = await client.from('regional_collection_batches').select('*')
      .eq('region', REGION).in('status', ['pending', 'failed', 'complete'])
      .lte('next_attempt_at', new Date().toISOString())
      .order('last_completed_at', { ascending: true, nullsFirst: true })
      .order('priority').order('id').limit(batchLimit || 1);
    if (error) throw new Error(`regional due batches: ${error.message}`);
    for (const batch of (batchLimit ? data || [] : []) as BatchState[]) {
      if (source.requests >= sourceLimit) break;
      try {
        const payload = await fetchBatch(batch);
        const incoming = parsePlaces(payload, batch);
        const candidates = incoming.length ? await identityCandidates(batch, incoming) : [];
        const rows = dedupePlaces(incoming, candidates);
        written += await writePlaces(rows);
        const now = Date.now();
        await checkpoint(batch, {
          status: 'complete', attempts: 0, place_count: rows.length, last_error: null,
          last_completed_at: new Date(now).toISOString(), next_attempt_at: new Date(now + REFRESH_MS).toISOString(),
        });
        completed++;
      } catch (error) {
        if (error instanceof SourceBudgetExhausted) break;
        if (error instanceof BatchTooLarge && batch.depth < 4) {
          // Children must exist durably before the parent is retired. A crash
          // between these writes only repeats an idempotent subdivision.
          const { error: splitError } = await client.from('regional_collection_batches')
            .upsert(splitBatch(batch), { onConflict: 'id', ignoreDuplicates: true });
          if (splitError) throw new Error(`regional subdivision: ${splitError.message}`);
          await checkpoint(batch, { status: 'split', last_error: 'subdivided to preserve complete coverage' });
          split++;
          continue;
        }
        const message = error instanceof Error ? error.message : 'regional batch failed';
        const attempts = batch.attempts + 1;
        const retryAt = failureRetryAt(attempts);
        const sourceRetryAt = error instanceof SourceRequestError && error.retryAfterMs
          ? new Date(Date.now() + Math.max(error.retryAfterMs, Date.parse(retryAt) - Date.now())).toISOString() : retryAt;
        await checkpoint(batch, { status: 'failed', attempts, next_attempt_at: sourceRetryAt, last_error: message.slice(0, 300) });
        failed++;
        if (error instanceof SourceRequestError && (error.message === 'Overpass HTTP 429' || error.retryAfterMs > 30_000)) break;
      }
    }
  } catch (error) { fatal = error instanceof Error ? error : new Error('regional collection failed'); }

  // One compact, source-payload-free coverage summary. Checkpoints and output
  // rows are the durable extracted-data cache, even if the runner disappears.
  const [pool, sf, batches] = await Promise.all([
    client.from('regional_places').select('id', { count: 'exact', head: true }),
    client.from('regional_places').select('id', { count: 'exact', head: true }).eq('city', 'san-francisco'),
    client.from('regional_collection_batches').select('status,next_attempt_at').eq('region', REGION).limit(5000),
  ]);
  const coverage = batches.data || [];
  const active = coverage.filter(batch => batch.status !== 'split');
  const covered = active.filter(batch => batch.status === 'complete').length;
  const due = active.filter(batch => Date.parse(batch.next_attempt_at) <= Date.now()).length;
  const status = fatal || failed && !completed ? 'failed' : failed ? 'partial' : 'ok';
  const detail = `regional: ${pool.count ?? '?'} places, ${sf.count ?? '?'} SF; tiles ${covered}/${active.length} covered, ${due} due; ${completed} completed, ${split} subdivided, ${failed} failed; ${written} writes; source ${source.requests}/${sourceLimit} requests, ${source.bytes} bytes`;
  console.log(detail);
  const { error: logError } = await client.from('regional_collection_runs').insert({
    region: REGION, started_at: startedAt, finished_at: new Date().toISOString(), status,
    source_requests: source.requests, source_bytes: source.bytes, batches_completed: completed,
    rows_written: written, detail: (fatal ? `${detail}; ${fatal.message}` : detail).slice(0, 1000),
  });
  if (logError) console.warn('regional run summary could not be saved:', logError.message);
  const { error: retentionError } = await client.from('regional_collection_runs').delete()
    .lt('finished_at', new Date(Date.now() - 90 * 86_400_000).toISOString());
  if (retentionError) console.warn('regional run retention skipped:', retentionError.message);
  if (pool.error || sf.error || batches.error) console.warn('regional coverage summary is incomplete');
  if (fatal) console.error(fatal.message);
  if (status === 'failed') process.exitCode = 1;
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'regional collection failed');
  process.exitCode = 1;
});
