import type { NightlifeSpot, Restaurant, ScoperEvent } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';
import { planFromShape } from '@/lib/plan-from-shape';
import type { SolvedNight } from '@/lib/plan-engine';

function restaurant(overrides: Partial<Restaurant> & { id: string }): Restaurant {
  return {
    name: overrides.id, cuisine: 'Test', price: '$$', distanceLabel: '0.1 mi', image: '', dishImage: '',
    readyEstimate: '20 min', detailFacts: [], highlightsLabel: '', popularDishes: [], menuHighlights: [],
    menuUrl: '', hasDelivery: false, openLate: false, address: '', sourceUrl: '',
    primaryAction: { label: 'Menu', url: '' }, ...overrides,
  };
}
function event(overrides: Partial<ScoperEvent> & { id: string }): ScoperEvent {
  return {
    name: overrides.id, time: '8 PM', priceLabel: 'Free', travel: '', cats: [], date: '', venue: 'Venue',
    addr: '', lineup: '', know: '', priceFrom: 'Free', allIn: 'Free', ticketed: false, sourceUrl: '',
    verifiedLabel: '', image: '', ...overrides,
  };
}
function spot(overrides: Partial<NightlifeSpot> & { id: string }): NightlifeSpot {
  return { name: overrides.id, kind: 'Bar', hours: '', address: '', desc: '', url: '', ...overrides };
}

const solve = (over: Partial<SolvedNight> = {}): SolvedNight => ({
  restaurant: null, event: null, nightlifeSpot: null,
  reasons: { restaurant: [], event: [], nightlife: [] },
  ...over,
});

const HERE: GeoPoint = { latitude: 37.8044, longitude: -122.2712 };
const NEAR: GeoPoint = { latitude: 37.805, longitude: -122.2712 };
const AT = new Date('2026-08-27T17:00:00-07:00');
const nowhere = () => null;

describe('planFromShape', () => {
  it('carries the solved night through untouched', () => {
    const solved = solve({ restaurant: restaurant({ id: 'commis' }), event: event({ id: 'show' }) });
    expect(planFromShape(solved, AT, nowhere).solved).toBe(solved);
  });

  it('orders the stops and names dinner’s hour', () => {
    const plan = planFromShape(
      solve({ restaurant: restaurant({ id: 'commis' }), event: event({ id: 'show', time: '8 PM' }) }),
      AT,
      nowhere,
    );
    expect(plan.stopOrder).toEqual(['dinner', 'event']);
    expect(plan.dinnerTimeLabel).toMatch(/\d/);
  });

  it('measures a leg when both ends have coordinates', () => {
    const points: Record<string, GeoPoint> = { commis: HERE, Venue: NEAR };
    const plan = planFromShape(
      solve({ restaurant: restaurant({ id: 'commis' }), event: event({ id: 'show' }) }),
      AT,
      (place) => points[place.name] ?? null,
    );
    expect(plan.stopLegs).toHaveLength(1);
    expect(plan.stopLegs[0]).toEqual(expect.stringContaining('min'));
  });

  it('leaves a leg null rather than guessing a distance', () => {
    const plan = planFromShape(
      solve({ restaurant: restaurant({ id: 'commis' }), event: event({ id: 'show' }) }),
      AT,
      nowhere,
    );
    expect(plan.stopLegs).toEqual([null]);
  });

  it('is a strong match when the night has something in it', () => {
    expect(planFromShape(solve({ restaurant: restaurant({ id: 'commis' }) }), AT, nowhere).confidence).toBe('strong');
    expect(planFromShape(solve({ event: event({ id: 'show' }) }), AT, nowhere).confidence).toBe('strong');
  });

  it('falls back when neither a kitchen nor a show could be placed', () => {
    expect(planFromShape(solve(), AT, nowhere).confidence).toBe('fallback');
    // A nightcap on its own is not a night — the adapter reads it the same way.
    expect(planFromShape(solve({ nightlifeSpot: spot({ id: 'arbor' }) }), AT, nowhere).confidence).toBe('fallback');
  });

  it('claims no relaxed constraint and writes no note — a shape asked for nothing', () => {
    const plan = planFromShape(solve({ restaurant: restaurant({ id: 'commis' }) }), AT, nowhere);
    expect(plan.relaxed).toEqual([]);
    expect(plan.notes).toEqual([]);
  });
});
