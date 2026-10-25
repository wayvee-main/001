/** Server-only official HTML loader shared by legacy and regional enrichment. */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { SourceBudgetExhausted } from './detail-source-cache';

export const OFFICIAL_BODY_LIMIT = 4_000_000;
const blockedIp = (ip: string): boolean => {
  if (ip.includes(':')) return /^(::|fc|fd|fe|ff)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return !Number.isFinite(a) || a === 0 || a === 10 || a === 127 || a >= 224
    || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
    || a === 192 && (b === 168 || b === 0) || a === 100 && b >= 64 && b <= 127
    || a === 198 && (b === 18 || b === 19);
};
type LoaderOptions = {
  request?: typeof fetch;
  resolve?: (hostname: string) => Promise<string[]>;
};

export class OfficialSourceLoader {
  requests = 0;
  bytes = 0;
  private readonly request: typeof fetch;
  private readonly resolve: (hostname: string) => Promise<string[]>;
  constructor(readonly limit: number, options: LoaderOptions = {}) {
    this.request = options.request || fetch;
    this.resolve = options.resolve || (async hostname => (await lookup(hostname, { all: true })).map(address => address.address));
  }

  private async publicUrl(raw: string): Promise<URL> {
    const url = new URL(raw);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname)
      || !url.hostname.includes('.') || /\.(local|internal|localhost)$/.test(url.hostname)) throw new Error('non-public source URL');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const addresses = await Promise.race([
        this.resolve(url.hostname),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('source DNS timeout')), 5000); }),
      ]);
      if (!addresses.length || addresses.some(blockedIp)) throw new Error('non-public source address');
    } finally { if (timer) clearTimeout(timer); }
    return url;
  }

  async load(raw: string, headers: Record<string, string>, onRequest?: () => void) {
    if (this.requests >= this.limit) throw new SourceBudgetExhausted();
    let url = await this.publicUrl(raw);
    for (let redirect = 0; redirect < 4; redirect++) {
      // Recheck after asynchronous DNS: four workers share one strict budget.
      if (this.requests >= this.limit) throw new SourceBudgetExhausted();
      this.requests++;
      onRequest?.();
      const response = await this.request(url, {
        redirect: 'manual', signal: AbortSignal.timeout(12_000),
        headers: { ...headers, 'User-Agent': 'WayveeOfficialSourceSync/1.0 (+https://github.com/wayvee-main/001)', Accept: 'text/html, application/xhtml+xml' },
      });
      const validators = { etag: response.headers.get('etag') || undefined, lastModified: response.headers.get('last-modified') || undefined };
      if (response.status === 304) { await response.body?.cancel(); return { status: 304, ...validators }; }
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        await response.body?.cancel();
        url = await this.publicUrl(new URL(response.headers.get('location')!, url).href);
        continue;
      }
      if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel(); throw new Error('official HTML source unavailable');
      }
      if (Number(response.headers.get('content-length')) > OFFICIAL_BODY_LIMIT) {
        await response.body?.cancel(); throw new Error('source page too large');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('empty source');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength; this.bytes += part.value.byteLength;
        if (size > OFFICIAL_BODY_LIMIT) { await reader.cancel(); throw new Error('source page too large'); }
        chunks.push(part.value);
      }
      return { status: 200, body: Buffer.concat(chunks).toString('utf8'), ...validators };
    }
    throw new Error('too many source redirects');
  }
}
