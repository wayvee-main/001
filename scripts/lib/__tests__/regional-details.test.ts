/** @jest-environment node */
import { OfficialSourceLoader, OFFICIAL_BODY_LIMIT } from '../official-source-loader';
import { DetailSourceCache, SourceBudgetExhausted } from '../detail-source-cache';
import { mergeRegionalDetails, detailRetryAt } from '../regional-details';
import type { DetailContent } from '../../../src/lib/detail-content';

const resolve = jest.fn(async () => ['8.8.8.8']);
const html = () => new Response('<html>official</html>', { headers: { 'content-type': 'text/html', etag: 'v1' } });
beforeEach(() => resolve.mockClear());

it('enforces a shared request budget across four workers and counts redirects', async () => {
  const request = jest.fn(async () => html());
  const loader = new OfficialSourceLoader(2, { request: request as typeof fetch, resolve });
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => loader.load('https://venue.example/', {})));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
  expect(loader.requests).toBe(2); expect(request).toHaveBeenCalledTimes(2);
  const redirect = new OfficialSourceLoader(1, { resolve, request: (async () => new Response('', { status: 302, headers: { location: '/menu' } })) as typeof fetch });
  await expect(redirect.load('https://venue.example/', {})).rejects.toBeInstanceOf(SourceBudgetExhausted);
  expect(redirect.requests).toBe(1);
});

it('checks every redirect destination and rejects literal/private DNS targets', async () => {
  const request = jest.fn(async () => new Response('', { status: 302, headers: { location: 'https://private.example/menu' } }));
  const loader = new OfficialSourceLoader(30, {
    request: request as typeof fetch,
    resolve: async host => host === 'private.example' ? ['192.168.1.2'] : ['8.8.8.8'],
  });
  await expect(loader.load('https://venue.example/', {})).rejects.toThrow('non-public source address');
  expect(loader.requests).toBe(1);
  await expect(loader.load('https://127.0.0.1/', {})).rejects.toThrow('non-public source URL');
  expect(request).toHaveBeenCalledTimes(1);
});

it('passes conditional validators, accepts 304 and bounds source content', async () => {
  const request = jest.fn(async () => new Response(null, { status: 304 }));
  const loader = new OfficialSourceLoader(30, { request: request as typeof fetch, resolve });
  await expect(loader.load('http://venue.example/', { 'If-None-Match': 'v1' })).resolves.toMatchObject({ status: 304 });
  const [url, options] = request.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.protocol).toBe('https:'); expect(options.headers).toMatchObject({ 'If-None-Match': 'v1' });
  const pdf = new OfficialSourceLoader(1, { resolve, request: (async () => new Response('PDF', { headers: { 'content-type': 'application/pdf' } })) as typeof fetch });
  await expect(pdf.load('https://venue.example/menu.pdf', {})).rejects.toThrow('HTML source unavailable');
  const huge = new OfficialSourceLoader(1, { resolve, request: (async () => new Response(new Uint8Array(OFFICIAL_BODY_LIMIT + 1), { headers: { 'content-type': 'text/html' } })) as typeof fetch });
  await expect(huge.load('https://venue.example/', {})).rejects.toThrow('page too large');
});

it('retains existing menu items, item photos and venue photos when parsed goods are partial', () => {
  const existing: DetailContent = { version: 1, sourceUrl: 'https://venue.example/', verifiedAt: '2026-10-25T00:00:00Z', photos: [{ url: 'https://venue.example/owned.jpg' }], menu: { url: 'https://venue.example/menu', items: [{ name: 'Soup', image: 'https://venue.example/soup.jpg', price: '$10', categories: [] }, { name: 'Salad', categories: [] }] } };
  expect(mergeRegionalDetails(existing, undefined)).toBe(existing);
  const merged = mergeRegionalDetails(existing, { ...existing, photos: [], menu: { ...existing.menu!, items: [{ name: 'Soup', price: '$12', categories: [] }] } });
  expect(merged?.photos?.[0].url).toBe('https://venue.example/owned.jpg');
  expect(merged?.menu?.items).toHaveLength(2);
  expect(merged?.menu?.items[0]).toMatchObject({ image: 'https://venue.example/soup.jpg', price: '$12' });
});

it('persists source freshness/failures for durable queue decisions without penalizing budget exhaustion', async () => {
  const cache = new DetailSourceCache(), now = Date.parse('2026-10-25T12:00:00Z');
  await cache.read('good', async () => ({ status: 200, body: 'html', etag: 'v1' }), () => ({ links: [] }), now);
  expect(cache.status('good')).toMatchObject({ failures: 0, nextCheckAt: now + 7 * 86_400_000 });
  await cache.read('bad', async () => { throw new Error('offline'); }, () => ({ links: [] }), now);
  expect(cache.status('bad')).toMatchObject({ failures: 1, nextCheckAt: now + 86_400_000 });
  await cache.read('untouched', async () => { throw new SourceBudgetExhausted(); }, () => ({ links: [] }), now);
  expect(cache.status('untouched')).toBeUndefined();
  expect(Date.parse(detailRetryAt(99, now))).toBe(now + 7 * 86_400_000);
  expect(JSON.stringify(cache.snapshot())).not.toContain('html');
});
