import { bannerPageForId, homeRecommendations, promotionIsCurrent } from '@/lib/home-recommendations';
import { localOffers } from '@/lib/local-perks';
import type { HomeGuideCatalog, HomeGuideEntry } from '@/lib/home-guide';

const at = (hour: number, day = 3) => new Date(2026, 10, day, hour);
const verified = new Date(2026, 10, 2, 12).toISOString();
const source = 'https://venue.example/menu';
const entry = (id: string, overrides: Partial<HomeGuideEntry> = {}): HomeGuideEntry => ({
  kind: 'place', id, name: id, caption: 'Restaurant', category: 'restaurant', description: '', searchText: id,
  glyph: 'food', facts: [], details: [], links: [],
  detailContent: { version: 1, sourceUrl: source, verifiedAt: verified }, ...overrides,
});
const catalog = (...entries: HomeGuideEntry[]): HomeGuideCatalog => ({
  entries: Object.fromEntries(entries.map(item => [item.kind + ':' + item.id, item])),
  categories: { eat: entries, bars: [], routes: [], events: [] }, collections: [],
});
const menuEntry = (id: string, categories = ['Dinner'], menuVerified = verified) => entry(id, {
  detailContent: { version: 1, sourceUrl: source, verifiedAt: verified, menu: { url: source, verifiedAt: menuVerified,
    items: [{ name: 'Chili crisp noodles', categories, price: '$18' }] } },
});

it('uses actual names and direct destinations instead of generic search intentions', () => {
  const picks = homeRecommendations(catalog(menuEntry('Good table')), at(19));
  expect(picks).toHaveLength(2);
  expect(picks[0]).toMatchObject({ kind: 'dish', label: 'Good table · Chili crisp noodles', basis: 'recently-verified', sourceUrl: source });
  expect(picks[0].href).toBe('/home/detail?kind=place&id=Good%20table&dish=Chili%20crisp%20noodles');
  expect(picks[1].href).toBe('/home/detail?kind=place&id=Good%20table');
});

it.each(['2026-10-01', 'invalid', '', '2026-11-10'])('rejects stale, unverified or future records: %s', date => {
  const old = entry('Old', { detailContent: { version: 1, sourceUrl: source, verifiedAt: date } });
  expect(homeRecommendations(catalog(old), at(19))).toEqual([]);
});

it('checks a menu’s own verification date independently of the venue', () => {
  expect(homeRecommendations(catalog(menuEntry('Cafe', ['Dinner'], '2026-10-01')), at(19)).map(item => item.kind)).toEqual(['venue']);
  const freshMenu = menuEntry('Fresh menu');
  freshMenu.detailContent!.verifiedAt = '2026-10-01';
  expect(homeRecommendations(catalog(freshMenu), at(19)).map(item => item.kind)).toEqual(['dish']);
});

it('uses source-published popularity, ahead of fresh verification, without inventing trend scores', () => {
  const popular = menuEntry('Popular cafe', ['Most ordered', 'Dinner']);
  popular.detailContent!.menu!.verifiedAt = new Date(2026, 10, 1).toISOString();
  const picks = homeRecommendations(catalog(menuEntry('New cafe'), popular), at(19));
  expect(picks[0]).toMatchObject({ label: 'Popular cafe · Chili crisp noodles', basis: 'source-popular' });
  expect(picks.find(pick => pick.venue === 'New cafe')?.basis).toBe('recently-verified');
  expect(homeRecommendations(catalog(menuEntry('Not proof', ['Chef recommendations'])), at(19)).every(pick => pick.basis !== 'source-popular')).toBe(true);
});

it('ranks verified timestamps, diversifies venues and never pads a short or empty pool', () => {
  const places = ['A', 'B', 'C', 'D', 'E'].map((name, i) => {
    const place = menuEntry(name); place.detailContent!.verifiedAt = new Date(2026, 10, 2, i).toISOString();
    place.detailContent!.menu!.verifiedAt = place.detailContent!.verifiedAt; return place;
  });
  const picks = homeRecommendations(catalog(...places), at(19));
  expect(picks.map(pick => pick.venue)).toEqual(['E', 'D', 'C', 'B']);
  expect(homeRecommendations(catalog(places[0]), at(19))).toHaveLength(2);
  expect(homeRecommendations(catalog(), at(19))).toEqual([]);
});

it('respects dayparts, known closure and late-night hours', () => {
  const coffee = menuEntry('Morning cafe', ['Coffee']); coffee.category = 'cafe';
  const dinner = menuEntry('Dinner house');
  const closed = menuEntry('Closed'); closed.openingHours = '09:00-11:00';
  const morning = homeRecommendations(catalog(coffee, dinner), at(8));
  expect(morning.every(pick => pick.venue === 'Morning cafe')).toBe(true);
  expect(morning.some(pick => pick.kind === 'dish')).toBe(true);
  expect(homeRecommendations(catalog(closed), at(19))).toEqual([]);
  expect(homeRecommendations(catalog(dinner), at(23))).toEqual([]);
  dinner.openingHours = '18:00-02:00';
  expect(homeRecommendations(catalog(dinner), at(23))).toHaveLength(2);
});

it('only recommends source-verified, upcoming events within the next 48 hours', () => {
  const event = (hours: number) => entry('Live show', { kind: 'event', startsAt: new Date(at(19).getTime() + hours * 3_600_000).toISOString() });
  expect(homeRecommendations(catalog(event(3)), at(19))[0]?.kind).toBe('event');
  for (const hours of [-1, 49]) expect(homeRecommendations(catalog(event(hours)), at(19))).toEqual([]);
});

it('removes expired offers from cached catalogs and only recommends currently scheduled promos', () => {
  const place = entry('Raw bar', { detailContent: { version: 1, sourceUrl: source, verifiedAt: verified, offers: [
    { title: '2 Buck Shuck', label: 'Daily · 3–6 PM', description: '$2 oysters · minimum 6', url: source },
    { title: 'Expired', label: '', description: '', url: source, expiresAt: new Date(2026, 10, 3, 12).toISOString() },
    { title: 'Invalid expiry', label: '', description: '', url: source, expiresAt: 'bad' },
  ] } });
  expect(localOffers(catalog(place), at(15))).toHaveLength(1);
  expect(homeRecommendations(catalog(place), at(15))[0]).toMatchObject({ kind: 'offer', label: 'Raw bar · $2 oysters' });
  expect(homeRecommendations(catalog(place), at(19)).some(pick => pick.kind === 'offer')).toBe(false);
  place.detailContent!.verifiedAt = '2026-10-01';
  expect(homeRecommendations(catalog(place), at(15))).toEqual([]);
});

it('filters menu happy-hour specials outside their explicit window', () => {
  const place = menuEntry('Raw bar', ['Happy hour']);
  place.detailContent!.menu!.items[0].note = 'Daily 3–6 PM';
  expect(homeRecommendations(catalog(place), at(15)).some(pick => pick.kind === 'dish')).toBe(true);
  expect(homeRecommendations(catalog(place), at(19)).some(pick => pick.kind === 'dish')).toBe(false);
});

it('handles explicit daily, weekday and overnight promotion windows conservatively', () => {
  expect(promotionIsCurrent('Daily · 3–6 PM', at(15))).toBe(true);
  expect(promotionIsCurrent('Daily · 3–6 PM', at(18))).toBe(false);
  expect(promotionIsCurrent('Daily 12–2 PM', at(12))).toBe(true);
  expect(promotionIsCurrent('Daily 10 PM–2 AM', at(1))).toBe(true);
  expect(promotionIsCurrent('Fri–Sat 10 PM–2 AM', at(1, 8))).toBe(true);
  expect(promotionIsCurrent('Weekdays 3–6 PM', at(15, 7))).toBe(false);
  for (const label of ['3–6 PM', 'Daily 13–6 PM', 'Until 9 PM', 'Oct 30 only', '11/10 only']) {
    expect(promotionIsCurrent(label, at(15))).toBe(false);
  }
});

it('keeps a banner’s identity after inserting or removing offers', () => {
  expect(bannerPageForId(['offer', 'vee', 'stay'], 'stay')).toBe(2);
  expect(bannerPageForId(['vee', 'stay'], 'stay')).toBe(1);
  expect(bannerPageForId(['vee', 'stay'], 'removed')).toBe(0);
});
