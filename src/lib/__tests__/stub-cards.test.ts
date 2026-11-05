import { describe, expect, it } from '@jest/globals';

import type { DiscoverDeal } from '@/lib/discover-deals';
import { dateLead, dealLead, stopLead, weeklyLead } from '@/lib/stub-cards';

const deal = (badge: string, what: string, extra: Partial<DiscoverDeal> = {}): DiscoverDeal => ({ id: badge + what, badge, who: 'Venue', what, action: { type: 'url', url: 'https://example.com' }, ...extra });
const WEDNESDAY = new Date(2026, 10, 4, 19, 30), THURSDAY = new Date(2026, 10, 5, 12);

describe('stub leads', () => {
  it('reads a dated event in the city’s own day, and refuses a missing date', () => {
    expect(dateLead('2026-11-14T20:00:00-08:00')).toEqual({ kind: 'date', top: 'NOV', value: '14', under: 'SAT' });
    // 11:30 PM in Oakland is already the next day in UTC; the tile keeps Oakland’s day.
    expect(dateLead('2026-11-14T23:30:00-08:00')).toMatchObject({ value: '14', under: 'SAT' });
    expect(dateLead(undefined)).toBeNull();
    expect(dateLead('soon')).toBeNull();
  });

  it('shows a weekly series by its weekday, never as a date', () => {
    expect(weeklyLead('Monday')).toEqual({ kind: 'date', top: 'EVERY', value: 'Mon', under: 'WEEKLY' });
  });

  it('gives a deal its price or its happy-hour window, not a calendar', () => {
    expect(dealLead(deal('$2', '$2 oysters · Daily, 3–6 PM · Minimum 6'))).toEqual({ kind: 'value', value: '$2', under: 'OYSTERS' });
    expect(dealLead(deal('$0', '$0 delivery fee · On eligible orders'))).toEqual({ kind: 'value', value: '$0', under: 'DELIVERY' });
    expect(dealLead(deal('%', 'Oakland deals nearby · Rotating % off and BOGO'))).toEqual({ kind: 'value', value: '%', under: 'OFF' });
    expect(dealLead(deal('HH', 'Happy hour Weekdays 3–6 PM'))).toEqual({ kind: 'value', value: '3–6', under: 'PM' });
    expect(dealLead(deal('HH', 'Happy hour 3–5 PM · 8 PM–close'))).toEqual({ kind: 'value', value: '3–5', under: 'PM' });
    expect(dealLead(deal('', 'Get there by ride', { glyph: 'car' }))).toEqual({ kind: 'glyph', glyph: 'car', under: 'RIDE' });
  });

  it('calls an all-day happy hour only on the day it names', () => {
    const aburaya = deal('HH', 'Happy hour 2–6 PM Mon, Tue, Thu & Fri · all day Wednesday');
    expect(dealLead(aburaya, WEDNESDAY)).toEqual({ kind: 'value', value: 'All', under: 'DAY' });
    expect(dealLead(aburaya, THURSDAY)).toEqual({ kind: 'value', value: '2–6', under: 'PM' });
  });

  it('numbers route stops from start to finish', () => {
    expect([0, 1, 2].map(index => stopLead(index, 3))).toEqual([
      { kind: 'value', value: '1', under: 'START' }, { kind: 'value', value: '2', under: undefined }, { kind: 'value', value: '3', under: 'FINISH' },
    ]);
  });
});
