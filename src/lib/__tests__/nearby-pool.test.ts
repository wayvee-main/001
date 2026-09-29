import { nearbyMetaLine, openBadgeLabel, rankNearby } from '@/lib/nearby-pool';
import type { OpenState } from '@/lib/hours';

const open = (closesAt: string | null = '10 PM'): OpenState => ({ status: 'open', closesAt, closesInMinutes: null });
const closed = (opensAt: string | null = 'Tue 11 AM'): OpenState => ({ status: 'closed', opensAt });
const unknown: OpenState = { status: 'unknown' };
const at = (id: string, miles: number | null, state: OpenState) => ({ item: { id }, miles, state });

describe('rankNearby', () => {
  it('puts open places first, nearest within them', () => {
    const ranked = rankNearby([at('far-open', 3, open()), at('near-open', 0.4, open())]);
    expect(ranked.map((r) => r.item.id)).toEqual(['near-open', 'far-open']);
  });

  it('ranks an unknown state below open but above closed, rather than dropping it', () => {
    const ranked = rankNearby([at('closed', 0.1, closed()), at('unknown', 5, unknown), at('open', 9, open())]);
    expect(ranked.map((r) => r.item.id)).toEqual(['open', 'unknown', 'closed']);
  });

  it('sorts an unmeasurable distance after a measured one in the same tier', () => {
    const ranked = rankNearby([at('nodistance', null, open()), at('measured', 8, open())]);
    expect(ranked.map((r) => r.item.id)).toEqual(['measured', 'nodistance']);
  });

  it('honours the limit and does not mutate its input', () => {
    const input = [at('a', 3, open()), at('b', 1, open()), at('c', 2, open())];
    const ranked = rankNearby(input, 2);
    expect(ranked.map((r) => r.item.id)).toEqual(['b', 'c']);
    expect(input.map((r) => r.item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('openBadgeLabel', () => {
  it('states the closing time when there is one', () => {
    expect(openBadgeLabel(open('10 PM'))).toBe('Open till 10 PM');
  });

  it('says only "Open now" for a round-the-clock spot', () => {
    expect(openBadgeLabel(open(null))).toBe('Open now');
  });

  it('names the next opening when closed', () => {
    expect(openBadgeLabel(closed('Tue 11 AM'))).toBe('Opens Tue 11 AM');
    expect(openBadgeLabel(closed(null))).toBe('Closed now');
  });

  it('says nothing at all when the hours are unknown', () => {
    expect(openBadgeLabel(unknown)).toBeNull();
  });
});

describe('nearbyMetaLine', () => {
  it('prefers a measured distance over the catalog label', () => {
    expect(nearbyMetaLine({ cuisine: 'Thai', miles: 0.72, distanceLabel: '12 min walk' })).toBe('Thai · 0.7 mi');
  });

  it('falls back to the catalog label when nothing is measurable', () => {
    expect(nearbyMetaLine({ cuisine: 'Ramen', miles: null, distanceLabel: '14 min walk' })).toBe('Ramen · 14 min walk');
  });

  it('drops the distance entirely rather than inventing one', () => {
    expect(nearbyMetaLine({ cuisine: 'Oysters', miles: null })).toBe('Oysters');
  });

  it('rounds a long distance to whole miles', () => {
    expect(nearbyMetaLine({ cuisine: 'BBQ', miles: 12.4 })).toBe('BBQ · 12 mi');
  });
});
