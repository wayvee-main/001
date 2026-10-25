/** Bounded official-site goods for the regional pool. No LLM calls or raw-page
 * persistence. Durable due timestamps keep the queue advancing between runs. */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseDetailContent } from '../src/lib/detail-content';
import { serviceClient } from './lib/sync-run';
import { DetailSourceCache, SourceBudgetExhausted } from './lib/detail-source-cache';
import { OfficialSourceLoader } from './lib/official-source-loader';
import { extractOfficialMenu, officialMenuLinks } from './lib/menu-schema';
import { mergeRegionalDetails, detailRetryAt } from './lib/regional-details';
import { boundedInteger } from './lib/regional-places';

const client = serviceClient('enrich regional places');
const limit = boundedInteger(process.env.REGIONAL_DETAIL_REQUEST_LIMIT, 30, 30);
const loader = new OfficialSourceLoader(limit);
const cachePath = process.env.REGIONAL_DETAIL_CACHE_PATH || '.cache/regional-detail-sources-v1.json';
const cache = new DetailSourceCache((() => { try { return JSON.parse(readFileSync(cachePath, 'utf8')); } catch { return undefined; } })());

async function main() {
  const startedAt = new Date().toISOString();
  const { data, error } = await client.from('regional_places')
    .select('id,name,address,website,image,detail_content,detail_failure_count')
    .eq('needs_review', false).lte('detail_next_check_at', startedAt)
    .or('website.not.is.null,detail_content->>sourceUrl.not.is.null')
    .order('detail_next_check_at').order('id').limit(limit ? 40 : 0);
  if (error) throw new Error(`regional detail queue: ${error.message}`);
  let index = 0, checked = 0, written = 0, menus = 0, items = 0, photos = 0, unavailable = 0;
  const failures: Error[] = [];
  async function worker() {
    while (index < (data || []).length && loader.requests < limit) {
      const place = data![index++];
      const existing = parseDetailContent(place.detail_content);
      const raw = existing?.sourceUrl || place.website?.split(';')[0]
        || (typeof place.detail_content?.sourceUrl === 'string' ? place.detail_content.sourceUrl : undefined);
      if (!raw) continue;
      let content = existing, exhausted = false, sourceFailed = false, attempted = false;
      const sourceStates: { checkedAt: number; nextCheckAt: number; failures: number }[] = [];
      async function readSource(url: string) {
        const key = JSON.stringify(['regional', place.id, place.name, place.address, url]);
        const result = await cache.read(key, async headers => {
          try { return await loader.load(url, headers, () => { attempted = true; }); }
          catch (error) { if (error instanceof SourceBudgetExhausted) exhausted = true; else sourceFailed = true; throw error; }
        }, html => ({ content: extractOfficialMenu(html, url, place), links: officialMenuLinks(html, url) }));
        const state = cache.status(key);
        if (state) { sourceStates.push(state); if (state.failures) sourceFailed = true; }
        return result;
      }
      try {
        const source = await readSource(raw);
        content = mergeRegionalDetails(content, source?.content);
        if (!content?.menu?.items.length) {
          for (const link of (source?.links || []).filter(link => link !== raw).slice(0, 2)) {
            content = mergeRegionalDetails(content, (await readSource(link))?.content);
            if (content?.menu?.items.length || exhausted) break;
          }
        }
        // A worker that lost the shared budget before its first request must
        // remain due. Its cache and backoff are not penalized.
        if (exhausted && !attempted) continue;
        const now = Date.now(), failureCount = sourceFailed ? place.detail_failure_count + 1 : 0;
        const next = exhausted ? new Date(now + 3_600_000).toISOString()
          : sourceFailed ? detailRetryAt(failureCount, now)
          : new Date(Math.max(now + 60_000, ...sourceStates.map(state => state.nextCheckAt))).toISOString();
        const payload: Record<string, unknown> = {
          detail_next_check_at: next, detail_checked_at: new Date(now).toISOString(), detail_failure_count: failureCount,
        };
        if (content && JSON.stringify(content) !== JSON.stringify(existing)) payload.detail_content = content;
        if (!place.image && content?.photos?.[0]?.url) payload.image = content.photos[0].url;
        const { error: updateError } = await client.from('regional_places').update(payload).eq('id', place.id);
        if (updateError) throw new Error(`regional detail update: ${updateError.message}`);
        checked++; if (sourceFailed) unavailable++;
        if (payload.detail_content || payload.image) written++;
        if (content?.menu?.items.length) { menus++; items += content.menu.items.length; }
        photos += content?.photos?.length || 0;
      } catch (error) { failures.push(error instanceof Error ? error : new Error('regional enrichment failed')); }
    }
  }
  try { await Promise.all(Array.from({ length: 4 }, () => worker())); }
  finally { await mkdir(dirname(cachePath), { recursive: true }); await writeFile(cachePath, JSON.stringify(cache.snapshot())); }
  const detail = `regional goods: ${checked} checked, ${written} goods writes, ${menus} menus, ${items} dishes, ${photos} photos; official HTTP ${loader.requests}/${limit}, ${loader.bytes} bytes; ${cache.stats.cached} cached, ${cache.stats.unchanged} unchanged, ${unavailable} unavailable, ${failures.length} write errors`;
  console.log(detail);
  const { error: logError } = await client.from('regional_collection_runs').insert({
    started_at: startedAt, status: failures.length ? 'partial' : 'ok', rows_written: written,
    source_requests: loader.requests, source_bytes: loader.bytes, detail,
  });
  if (logError) console.warn('regional detail summary unavailable:', logError.message);
  if (failures.length) throw failures[0];
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'regional detail enrichment failed'); process.exitCode = 1; });
