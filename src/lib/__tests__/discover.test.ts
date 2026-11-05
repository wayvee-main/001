import { describe, expect, it } from '@jest/globals';

import { buildDiscoverGuide, weeklySeries } from '@/lib/discover-categories';
import { coversToday, discoverDeals } from '@/lib/discover-deals';
import type { HomeGuideCatalog, HomeGuideEntry } from '@/lib/home-guide';
import type { WayveePromotion } from '@/lib/promotions';

const entry = (kind: HomeGuideEntry['kind'], id: string, name: string, caption: string, extra: Partial<HomeGuideEntry> = {}): HomeGuideEntry => ({
  kind, id, name, caption, description: caption, glyph: 'food', facts: [], searchText: name, details: [], links: [], ...extra,
});
const catalogOf = (entries: HomeGuideEntry[]): HomeGuideCatalog => ({
  entries: Object.fromEntries(entries.map(item => [item.kind + ':' + item.id, item])), categories: { eat: [], bars: [], routes: [], events: [] }, collections: [],
});
const WEDNESDAY = new Date(2026, 10, 4, 19, 30), SATURDAY = new Date(2026, 10, 7, 12), THURSDAY = new Date(2026, 10, 5, 12);
const titles = (guide: ReturnType<typeof buildDiscoverGuide>, id: string) => guide.byId[id]?.entries.map(item => item.name);

describe('buildDiscoverGuide', () => {
  const guide = buildDiscoverGuide(catalogOf([
    entry('restaurant', 'mua', 'MUA Oakland', 'Californian', { facts: [{ glyph: 'wallet', value: '$$' }] }),
    entry('restaurant', 'lovelys', 'Lovely’s', 'Smash burgers', { facts: [{ glyph: 'wallet', value: '$' }] }),
    entry('restaurant', 'nick', 'Nick’s Pizza', 'Sourdough pizza'),
    entry('restaurant', 'star', 'Shooting Star Cafe', 'Hong Kong cafe'),
    entry('place', 'broken', 'Broken Dreams', 'Vietnamese · cafe', { category: 'cafe' }),
    entry('place', 'tay', 'Tay Ho Restaurant', 'Vietnamese · restaurant', { category: 'restaurant' }),
    entry('place', 'pie-osm', 'Nick’s Pizza', 'Pizza · restaurant', { category: 'restaurant' }),
    entry('restaurant', 'cook', 'The Cook and Her Farmer', 'Oysters'),
    entry('place', 'district', 'District', 'restaurant', { category: 'restaurant' }),
    entry('night', 'bird', 'Little Bird', 'Neighborhood cocktail bar'),
    entry('night', 'heron', 'Night Heron', 'Cocktails, music & local art'),
    entry('night', 'hello', 'Hello Stranger', 'DJ bar'),
    entry('night', 'arbor', 'The Arbor', 'Craft beer taproom'),
    entry('night', 'athletic', 'The Athletic Club Oakland', 'Sports bar'),
    entry('venue', 'yoshis', 'Yoshi’s', 'Live music venue & Japanese restaurant'),
    entry('venue', 'fox', 'Fox Theater', 'Restored 1928 movie palace'),
    entry('venue', 'elis', 'Eli’s Mile High Club', 'West Oakland blues bar · 21+', { details: [{ label: 'Blue Mondays', value: '7–11 PM · this week: a guest · RSVP' }] }),
    entry('event', 'late', 'Later Show', 'Fox Theater', { startsAt: '2026-11-20T20:00:00-08:00' }),
    entry('event', 'soon', 'Sooner Show', 'Fox Theater', { startsAt: '2026-11-14T20:00:00-08:00' }),
    entry('outdoor', 'lake', 'Lake Merritt', 'Waterside paths · Oakland'),
    entry('crawl', 'hop', 'Downtown cocktail hop', '3 stops · 0.8 mi · walkable'),
    entry('collection', 'mix', 'A little of everything', '8 picks'),
  ]));

  it('sorts food by what each record says, keeping a place once', () => {
    expect(titles(guide, 'pizza')).toEqual(['Nick’s Pizza']);
    expect(titles(guide, 'coffee')).toEqual(['Broken Dreams']);
    expect(titles(guide, 'chinese-korean')).toEqual(['Shooting Star Cafe']);
    expect(titles(guide, 'southeast-asian')).toEqual(['Tay Ho Restaurant']);
    expect(titles(guide, 'seafood')).toEqual(['The Cook and Her Farmer']);
    expect(titles(guide, 'more-eat')).toEqual(['District']);
    expect(guide.families.find(family => family.id === 'eat')?.count).toBe(8);
  });
  it('sorts bars, venues and shows, and drops empty categories', () => {
    expect(titles(guide, 'cocktail-bars')).toEqual(['Little Bird', 'Night Heron']);
    expect(titles(guide, 'music-dancing')).toEqual(['Hello Stranger']);
    expect(titles(guide, 'beer')).toEqual(['The Arbor']);
    expect(titles(guide, 'sports-bars')).toEqual(['The Athletic Club Oakland']);
    expect(titles(guide, 'music-rooms')).toEqual(['Yoshi’s', 'Eli’s Mile High Club']);
    expect(titles(guide, 'theaters')).toEqual(['Fox Theater']);
    expect(titles(guide, 'shows')).toEqual(['Sooner Show', 'Later Show']);
    expect(guide.byId['more-bars']).toBeUndefined();
    expect(guide.byId.experiences).toBeUndefined();
    expect(guide.families.map(family => family.id)).toEqual(['eat', 'go-out', 'drink', 'wander']);
    expect(Object.values(guide.byId).some(category => category.entries.some(item => item.kind === 'collection'))).toBe(false);
  });
  it('builds cross-cutting shortcuts from published flags and prices only', () => {
    expect(titles(guide, 'open-late')).toEqual(['MUA Oakland', 'Lovely’s']);
    expect(guide.byId['open-late'].meta).toEqual({ mua: 'till 11 PM Fri–Sat' });
    expect(titles(guide, 'budget')).toEqual(['Lovely’s']);
    expect(titles(guide, 'live-music')).toEqual(['Yoshi’s', 'Eli’s Mile High Club', 'Night Heron', 'Hello Stranger']);
  });
  it('reads a venue’s weekly series without dating it', () => {
    expect(guide.series).toEqual([expect.objectContaining({ title: 'Blue Mondays', weekday: 'Monday', time: '7–11 PM', href: '/home/detail?kind=venue&id=elis' })]);
    expect(weeklySeries([entry('venue', 'x', 'X', 'Room', { details: [{ label: 'Hours', value: 'Mon & Thu 4 PM–1 AM' }] })])).toEqual([]);
  });
});

describe('coversToday', () => {
  it('tags only wording that plainly covers today', () => {
    expect(coversToday('Daily · 3–6 PM', SATURDAY)).toBe(true);
    expect(coversToday('Happy hour Weekdays 3–6 PM', WEDNESDAY)).toBe(true);
    expect(coversToday('Happy hour Weekdays 3–6 PM', SATURDAY)).toBe(false);
    expect(coversToday('2–6 PM Mon, Tue, Thu & Fri · all day Wednesday', WEDNESDAY)).toBe(true);
    expect(coversToday('2–6 PM Mon, Tue, Thu & Fri · all day Wednesday', THURSDAY)).toBe(false);
    expect(coversToday('Tue–Thu 4–6 PM', WEDNESDAY)).toBe(false);
  });
});

describe('discoverDeals', () => {
  const offerVenue = entry('place', 'boca', 'Bocanova', 'restaurant', {
    details: [{ label: 'Happy hour', value: 'Daily 3–6 PM' }],
    detailContent: { version: 1, sourceUrl: 'https://boca.example', verifiedAt: '2026-10-25T00:00:00Z', offers: [{ title: '2 Buck Shuck', label: 'Daily · 3–6 PM', description: '$2 oysters · minimum 6. From the official happy-hour menu.', url: 'https://boca.example/hh' }] },
  } as Partial<HomeGuideEntry>);
  const catalog = catalogOf([
    entry('restaurant', 'itani', 'Itani Ramen', 'Ramen', { details: [{ label: 'Happy hour', value: '3–5 PM · 8 PM–close' }] }),
    entry('restaurant', 'fob', 'FOB Kitchen', 'Filipino', { details: [{ label: 'Happy hour', value: 'Weekdays 3–6 PM' }] }),
    entry('restaurant', 'mago', 'Mägo', 'Colombian–Californian', { details: [{ label: 'Hours', value: 'Tue–Sat from 5 PM · bar happy hour 5–7 PM' }] }),
    entry('restaurant', 'plain', 'Plain Place', 'Thai', { details: [{ label: 'Hours', value: 'Daily 5–10 PM' }] }),
    offerVenue,
  ]);
  const partner: WayveePromotion = { id: 'uber-one', placement: 'ordering-savings', priority: 1, eyebrow: 'UBER ONE', brand: 'Uber One', title: '$0 delivery fee', detail: 'On eligible orders', tone: 'sage', actions: [{ label: 'Uber One', url: 'https://uber.example', primary: true }], verifiedAt: '2026-07-19' };

  it('uses only published offers, happy hours and the partners the screen passes', () => {
    const deals = discoverDeals(catalog, WEDNESDAY, [partner, undefined]);
    expect(deals.map(deal => deal.who)).toEqual(['Bocanova', 'FOB Kitchen', 'Itani Ramen', 'Mägo', 'Uber One']);
    expect(deals[0]).toMatchObject({ badge: '$2', what: '$2 oysters · Daily, 3–6 PM · Minimum 6', tag: 'Today', action: { type: 'offer' } });
    expect(deals.find(deal => deal.who === 'Mägo')).toMatchObject({ badge: 'HH', what: 'Bar happy hour 5–7 PM', action: { type: 'entry', href: '/home/detail?kind=restaurant&id=mago' } });
    expect(deals.find(deal => deal.who === 'Itani Ramen')?.tag).toBeUndefined();
    expect(deals.at(-1)).toMatchObject({ badge: '$0', tag: 'Partner', what: '$0 delivery fee · On eligible orders', action: { type: 'url', url: 'https://uber.example' } });
    expect(deals.some(deal => deal.who === 'Plain Place')).toBe(false);
    expect(discoverDeals(catalog, SATURDAY).find(deal => deal.who === 'FOB Kitchen')?.tag).toBeUndefined();
  });
});
