import { compactOffer, localOffers, perksEntries, perksAreaKey, toggleEveningStop, veeWildcard, type EveningStop } from '@/lib/local-perks';
import type { HomeGuideCatalog, HomeGuideEntry } from '@/lib/home-guide';

const entry = (id: string): HomeGuideEntry => ({ kind: 'place', id, name: id, caption: 'Restaurant', description: '', searchText: id, glyph: 'food', facts: [], details: [], links: [] });
const catalog = (entries: HomeGuideEntry[]): HomeGuideCatalog => ({ entries: Object.fromEntries(entries.map(item => [item.kind + ':' + item.id, item])), categories: { eat: entries, bars: [], routes: [], events: [] }, collections: [] });
const stop = (id: string, city = 'oakland'): EveningStop => ({ ...entry(id), city });

it('only promotes offers attached to the current location’s actual entries', () => {
  const source = { ...entry('raw-bar'), detailContent: { version: 1 as const, sourceUrl: 'https://venue.example/menu', verifiedAt: '2026-10-25T00:00:00Z',
    offers: [{ title: '2 Buck Shuck', label: 'Daily · 3–6 PM', description: '$2 oysters · minimum 6', url: 'https://venue.example/happy-hour' }] } };
  const offers = localOffers(catalog([source]));
  expect(offers).toHaveLength(1);
  expect(offers[0].href).toBe('/home/detail?kind=place&id=raw-bar');
  expect(compactOffer(offers[0])).toEqual({ title: '$2 oysters', detail: 'Daily, 3–6 PM · Minimum 6' });
  expect(localOffers(catalog([entry('sf-cafe')]))).toEqual([]);
});

it('rejects unsafe offer URLs and deduplicates the same source promotion', () => {
  const offer = { title: 'Lunch combo', label: 'Lunch menu', description: 'From the official menu', url: 'https://venue.example/menu' };
  const source = { ...entry('cafe'), detailContent: { version: 1 as const, sourceUrl: offer.url, verifiedAt: '2026-10-25', offers: [offer, offer, { ...offer, url: 'javascript:alert(1)' }] } };
  expect(localOffers(catalog([source]))).toHaveLength(1);
});

it('retains nearest order while removing duplicate identities in a rail', () => {
  expect(perksEntries(catalog([entry('near'), entry('next'), { ...entry('duplicate'), name: 'near' }]), 'eat').map(item => item.id)).toEqual(['near', 'next']);
});

it('toggles a stop without duplicating it, preserving the evening order', () => {
  const first = toggleEveningStop([], stop('one'));
  const two = toggleEveningStop(first, stop('two'));
  expect(two.map(item => item.id)).toEqual(['one', 'two']);
  expect(toggleEveningStop(two, stop('one')).map(item => item.id)).toEqual(['two']);
});

it('bounds each city’s evening independently and keeps removal possible at the limit', () => {
  const eight = Array.from({ length: 8 }, (_, index) => stop(String(index)));
  expect(toggleEveningStop(eight, stop('ninth'))).toEqual(eight);
  expect(toggleEveningStop(eight, stop('sf', 'san-francisco'))).toHaveLength(9);
  expect(toggleEveningStop(eight, stop('0'))).toHaveLength(7);
});

it('wildcards are unique current catalog entries and rotate without repeating the first suggestion', () => {
  const pool = catalog([entry('table'), entry('second')]); pool.categories.bars = [entry('table')];
  expect(veeWildcard(pool, 0)?.id).toBe('table');
  expect(veeWildcard(pool, 1)?.id).toBe('second');
  expect(veeWildcard(pool, 2)?.id).toBe('table');
  expect(veeWildcard(catalog([]), 0)).toBeUndefined();
});

it('scopes drafts to the phone’s Bay Area city instead of an old app-city setting', () => {
  expect(perksAreaKey('oakland', { latitude:37.7749, longitude:-122.4194, label:'San Francisco, CA' })).toBe('san-francisco');
  expect(perksAreaKey('oakland', null)).toBe('oakland');
  expect(perksAreaKey('oakland', { latitude:40.7, longitude:-74, label:'New York, NY' })).toBe('oakland');
});
