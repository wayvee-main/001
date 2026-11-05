import { cardMetadata, homeCardMetadata } from '@/lib/card-metadata';
import type { HomeGuideEntry } from '@/lib/home-guide';

const now = new Date('2026-11-03T23:00:00Z');
const entry: HomeGuideEntry = { kind: 'place', id: 'raw-bar', name: 'Raw bar', caption: 'Restaurant', description: '', searchText: '', glyph: 'food',
  facts: [{ glyph: 'pin', value: '<0.1 mi' }], details: [], links: [], detailContent: { version: 1, sourceUrl: 'https://venue.example/menu', verifiedAt: '2026-11-02',
    menu: { url: 'https://venue.example/menu', items: [{ name: 'Oysters', categories: ['Raw bar'] }] },
    offers: [{ title: '2 Buck Shuck', label: 'Daily · 3–6 PM', description: '$2 oysters · minimum 6', url: 'https://venue.example/offer' }] } };

it('builds the approved dock from actual distance, menu and offer records', () => {
  const result = cardMetadata(entry, now);
  expect(result.items.map(item => [item.text, item.tone])).toEqual([['0.1 mi', 'distance'], ['Menu', 'menu'], ['$2 oysters', 'offer']]);
  expect(result.note).toContain('3–6 PM');
  expect(result.note).toContain('Minimum 6');
  expect(result.items[2].label).toContain('minimum 6');
});

it('never pads missing facts or advertises an empty menu', () => {
  const sparse = { ...entry, facts: [], detailContent: undefined };
  expect(cardMetadata(sparse, now)).toEqual({ items: [] });
  expect(cardMetadata({ ...entry, detailContent: { ...entry.detailContent!, menu: { url: 'https://venue.example/menu', items: [] }, offers: [] } }, now).items.map(item => item.text)).toEqual(['0.1 mi']);
  const document = { ...entry.detailContent!, menu: undefined, menuDocuments: [{ url: 'https://venue.example/menu.pdf', title: 'Menu', format: 'pdf' as const }], offers: [] };
  expect(cardMetadata({ ...entry, detailContent: document }, now).items.some(item => item.key === 'menu')).toBe(true);
});

it.each(['2026-11-01', 'invalid'])('excludes expired or invalid cached offers: %s', expiresAt => {
  const content = { ...entry.detailContent!, offers: entry.detailContent!.offers!.map(offer => ({ ...offer, expiresAt })) };
  const result = cardMetadata({ ...entry, detailContent: content }, now);
  expect(result.items.some(item => item.key === 'offer')).toBe(false);
  expect(result.note).toBeUndefined();
});

it('keeps event times and prices factual, and removes wallet glyphs', () => {
  const result = cardMetadata({ ...entry, detailContent: undefined, facts: [{ glyph: 'calendar', value: 'Tomorrow', label: 'Nov 5' }, { glyph: 'wallet', value: 'From $35' }] }, now);
  expect(result.items[0]).toMatchObject({ text: 'Tomorrow', tone: 'category', label: 'Nov 5. Tomorrow' });
  expect(result.items[1]).toMatchObject({ text: 'From $35', tone: 'offer', glyph: undefined });
});

it('keeps the two-fact row layout compact without orphaning an offer note', () => {
  const result = cardMetadata(entry, now, 2);
  expect(result.items.map(item => item.text)).toEqual(['0.1 mi', 'Menu']);
  expect(result.note).toBeUndefined();
});

it('prioritizes a published menu and location for Home without repeating the promo', () => {
  expect(homeCardMetadata(entry, now).map(item => [item.text, item.tone])).toEqual([['Menu', 'menu'], ['0.1 mi', 'distance']]);
  const laterLocation = { ...entry, facts: [{ glyph: 'dollar', value: '$$' }, { glyph: 'clock', value: '6 PM' }, { glyph: 'pin', value: '0.4 mi' }] };
  expect(homeCardMetadata(laterLocation, now).map(item => item.text)).toEqual(['Menu', '0.4 mi']);
});

it('does not duplicate or invent Home metadata when source facts are sparse', () => {
  expect(homeCardMetadata({ ...entry, facts: [] }, now).map(item => item.key)).toEqual(['menu', 'offer']);
  expect(homeCardMetadata({ ...entry, facts: [], detailContent: undefined }, now)).toEqual([]);
  expect(homeCardMetadata({ ...entry, detailContent: undefined }, now).map(item => item.text)).toEqual(['0.1 mi']);
  const event = { ...entry, detailContent: undefined, facts: [{ glyph: 'calendar', value: 'Tomorrow' }, { glyph: 'wallet', value: 'From $35' }] };
  expect(homeCardMetadata(event, now).map(item => item.text)).toEqual(['Tomorrow', 'From $35']);
  const narrative = { ...entry, detailContent: undefined, facts: [{ glyph: 'pin', value: '1724 Broadway' }, { glyph: 'calendar', value: 'Nights posted on the official page' }] };
  expect(homeCardMetadata(narrative, now).map(item => item.text)).toEqual(['1724 Broadway']);
});
