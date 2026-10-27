import { createHash } from 'node:crypto';

import type { DetailContent } from '../../src/lib/detail-content';

const DAY = 86_400_000;
const VERSION = 1;
export class SourceBudgetExhausted extends Error {}
export interface SourceResult { content?: DetailContent; links: string[]; menuPage?:boolean }
interface SourceRecord extends SourceResult {
  checkedAt: number; nextCheckAt: number; failures: number;
  hash?: string; etag?: string; lastModified?: string;
}
interface SourceResponse { status: number; body?: string; etag?: string; lastModified?: string }

/** Persist extracted fields and HTTP validators, never raw source pages. */
export class DetailSourceCache {
  private records: Record<string, SourceRecord> = {};
  readonly stats = { cached: 0, unchanged: 0, parsed: 0, failed: 0 };

  constructor(saved?: unknown) {
    if (saved && typeof saved === 'object' && 'version' in saved && saved.version === VERSION && 'records' in saved && saved.records && typeof saved.records === 'object') {
      this.records = saved.records as Record<string, SourceRecord>;
    }
  }

  async read(
    key: string,
    request: (headers: Record<string, string>) => Promise<SourceResponse>,
    extract: (html: string) => SourceResult,
    now = Date.now(),
  ): Promise<SourceResult | undefined> {
    const old = this.records[key];
    if (old?.nextCheckAt > now) { this.stats.cached++; return old; }
    const headers: Record<string, string> = {};
    if (old?.etag) headers['If-None-Match'] = old.etag;
    if (old?.lastModified) headers['If-Modified-Since'] = old.lastModified;
    try {
      const response = await request(headers);
      if (response.status !== 200 && !(response.status === 304 && old?.hash)) throw new Error('Source unavailable');
      const hash = response.status === 304 ? old!.hash : createHash('sha256').update(response.body || '').digest('hex');
      const unchanged = !!old?.hash && hash === old.hash;
      const result = unchanged ? { content: old.content, links: old.links,menuPage:old.menuPage } : extract(response.body || '');
      if (unchanged) this.stats.unchanged++; else this.stats.parsed++;
      // A successful conditional response verifies the same published goods.
      const checked = new Date(now).toISOString();
      const content = result.content ? { ...result.content, verifiedAt: checked, menu: result.content.menu ? { ...result.content.menu, verifiedAt: checked } : undefined } : undefined;
      const record: SourceRecord = {
        content, links: result.links,menuPage:result.menuPage, hash, checkedAt: now, nextCheckAt: now + 7 * DAY, failures: 0,
        etag: response.etag || (unchanged ? old?.etag : undefined),
        lastModified: response.lastModified || (unchanged ? old?.lastModified : undefined),
      };
      this.records[key] = record;
      return record;
    } catch (error) {
      if (error instanceof SourceBudgetExhausted) return old;
      this.stats.failed++;
      const failures = (old?.failures || 0) + 1;
      this.records[key] = {
        ...old, links: old?.links || [], checkedAt: old?.checkedAt || 0,
        failures, nextCheckAt: now + Math.min(7, 2 ** Math.min(failures - 1, 3)) * DAY,
      };
      return old;
    }
  }

  snapshot() { return { version: VERSION, records: this.records }; }

  status(key: string): { checkedAt: number; nextCheckAt: number; failures: number } | undefined {
    const record = this.records[key];
    return record ? { checkedAt: record.checkedAt, nextCheckAt: record.nextCheckAt, failures: record.failures } : undefined;
  }
}
