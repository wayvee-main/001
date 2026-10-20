import { homeVenueActions, type HomeVenueCandidate } from '@/lib/home-quick-actions';

const at = (hour: number, minute = 0) => new Date(2026, 9, 20, hour, minute); // Tuesday, guest-local time.
const venue = (id: string, category: string, extra: Partial<HomeVenueCandidate> = {}): HomeVenueCandidate => ({
  id, name: id, href: `/place/${id}`, category, terms: [], openingHours: null, openLate: false, miles: 0.2, ...extra,
});
const catalog = [
  venue('First Cup', 'cafe', { openingHours: 'Mo-Fr 07:00-15:00' }),
  venue('Bread House', 'bakery', { miles: 0.3 }),
  venue('Supper Club', 'restaurant', { openingHours: 'Mo-Su 17:00-23:00' }),
  venue('Lunch Table', 'restaurant', { openingHours: 'Mo-Su 11:00-22:00' }),
  venue('All Night Kitchen', 'restaurant', { openingHours: '24/7', miles: 0.9 }),
];

describe('Home quick actions with real venue names', () => {
  it('pairs a real café with a real breakfast venue in the morning', () => {
    expect(homeVenueActions(catalog, at(8)).map(({ name, intent, glyph }) => ({ name, intent, glyph }))).toEqual([
      { name: 'First Cup', intent: 'Coffee', glyph: 'coffee' },
      { name: 'Bread House', intent: 'Breakfast', glyph: 'food' },
    ]);
  });
  it('switches to lunch restaurants at 11 AM, and preserves direct detail destinations', () => {
    const picks = homeVenueActions(catalog, at(11));
    expect(picks.map((pick) => pick.name)).toEqual(['Lunch Table', 'All Night Kitchen']);
    expect(picks.every((pick) => pick.intent === 'Lunch')).toBe(true);
    expect(picks[0].href).toBe('/place/Lunch Table');
  });
  it('offers coffee and a bite in the afternoon instead of a closed dinner-only venue', () => {
    expect(homeVenueActions(catalog, at(14)).map((pick) => pick.name)).toEqual(['First Cup', 'Bread House']);
  });
  it('switches to dinner at the boundary while excluding the closed café', () => {
    const picks = homeVenueActions(catalog, at(17));
    expect(picks.map((pick) => pick.name)).toEqual(['Lunch Table', 'Supper Club']);
    expect(picks.every((pick) => pick.intent === 'Dinner')).toBe(true);
  });
  it('keeps overnight openings across midnight and excludes unknown daytime cafés', () => {
    const picks = homeVenueActions([
      venue('Daytime Coffee', 'cafe'),
      venue('Night Noodles', 'restaurant', { openingHours: 'Mo-Su 18:00-02:00' }),
      venue('Night Bakery', 'bakery', { openingHours: '24/7', miles: 0.4 }),
    ], at(1));
    expect(picks.map((pick) => pick.name)).toEqual(['Night Noodles', 'Night Bakery']);
    expect(picks.every((pick) => pick.intent === 'Late bites')).toBe(true);
    expect(homeVenueActions([venue('Night Noodles', 'restaurant', { openingHours: 'Mo-Su 18:00-02:00' })], at(2))).toEqual([]);
  });
  it('allows a sourced late-hours signal without claiming the venue is open now', () => {
    expect(homeVenueActions([venue('Late Restaurant', 'restaurant', { openLate: true })], at(23))).toEqual([
      { id: 'Late Restaurant', name: 'Late Restaurant', href: '/place/Late Restaurant', intent: 'Late bites', glyph: 'food' },
    ]);
  });
  it('known closure wins over a generic late-hours flag', () => {
    expect(homeVenueActions([venue('Late Restaurant', 'restaurant', { openLate: true, openingHours: 'Mo-Su 11:00-23:00' })], at(23))).toEqual([]);
  });
  it('prefers a known-open match over one with unknown hours', () => {
    const picks = homeVenueActions([
      venue('Unknown Coffee', 'cafe', { miles: 0.1 }),
      venue('Open Coffee', 'cafe', { miles: 0.3, openingHours: '24/7' }),
    ], at(8));
    expect(picks.map((pick) => pick.name)).toEqual(['Open Coffee', 'Unknown Coffee']);
    expect(picks.every((pick) => pick.intent === 'Coffee')).toBe(true);
  });
  it('uses catalog breakfast terms without inventing coffee service at a bakery', () => {
    const picks = homeVenueActions([venue('Bagel Street', 'restaurant', { terms: ['bagels'] })], at(8));
    expect(picks[0]).toMatchObject({ name: 'Bagel Street', intent: 'Breakfast', glyph: 'food' });
  });
  it('deduplicates repeated venue IDs and equivalent names', () => {
    const picks = homeVenueActions([
      venue('one', 'cafe', { name: 'Sana’a Café' }),
      venue('two', 'cafe', { name: 'Sanaa Cafe' }),
      venue('one', 'cafe', { name: 'Second label' }),
    ], at(8));
    expect(picks).toHaveLength(1);
  });
  it('returns only the supplied city pool and never fills empty states with generic chips', () => {
    expect(homeVenueActions([], at(8))).toEqual([]);
    const picks = homeVenueActions([venue('SF Coffee', 'cafe', { href: '/place/sf-coffee' })], at(8));
    expect(picks).toHaveLength(1);
    expect(picks[0].name).toBe('SF Coffee');
  });
  it('keeps distance ordering among equally suitable open venues', () => {
    const picks = homeVenueActions([
      venue('Far Table', 'restaurant', { miles: 2 }),
      venue('Near Table', 'restaurant', { miles: 0.1 }),
    ], at(19));
    expect(picks.map((pick) => pick.name)).toEqual(['Near Table', 'Far Table']);
  });
});
