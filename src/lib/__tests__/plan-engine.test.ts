import type { NightlifeSpot, Restaurant, ScoperEvent } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';
import {
  computeDinnerTime,
  microDistrictOf,
  orderedLegs,
  planStopOrder,
  rankEvents,
  rankHomeSections,
  rankNightlife,
  rankRestaurants,
  solveNight,
  type ScoredPick,
} from '@/lib/plan-engine';
import type { WeatherHour } from '@/lib/weather';

function restaurant(overrides: Partial<Restaurant> & { id: string; price: string }): Restaurant {
  return {
    name: overrides.id,
    cuisine: 'Test',
    distanceLabel: '0.1 mi',
    image: '',
    dishImage: '',
    readyEstimate: '20 min',
    detailFacts: [],
    highlightsLabel: '',
    popularDishes: [],
    menuHighlights: [],
    menuUrl: '',
    hasDelivery: false,
    openLate: false,
    address: '',
    sourceUrl: '',
    primaryAction: { label: 'Menu', url: '' },
    ...overrides,
  };
}

function event(overrides: Partial<ScoperEvent> & { id: string }): ScoperEvent {
  return {
    name: overrides.id,
    time: '7 PM',
    priceLabel: 'Free',
    travel: '',
    cats: [],
    date: '',
    venue: 'Venue',
    addr: '',
    lineup: '',
    know: '',
    priceFrom: 'Free',
    allIn: 'Free',
    ticketed: false,
    sourceUrl: '',
    verifiedLabel: '',
    image: '',
    ...overrides,
  };
}

function nightlifeSpot(overrides: Partial<NightlifeSpot> & { id: string }): NightlifeSpot {
  return {
    name: overrides.id,
    kind: 'Bar',
    hours: '',
    address: '',
    desc: '',
    url: '',
    ...overrides,
  };
}

const HERE: GeoPoint = { latitude: 37.8044, longitude: -122.2712 };
const NEAR: GeoPoint = { latitude: 37.8050, longitude: -122.2712 }; // ~0.04 mi
const FAR: GeoPoint = { latitude: 37.95, longitude: -122.2712 }; // ~10 mi

describe('rankRestaurants', () => {
  it('ranks an exact budget match over a two-step-off one', () => {
    const cheap = restaurant({ id: 'cheap', price: '$' });
    const mid = restaurant({ id: 'mid', price: '$$' });
    const ranked = rankRestaurants([cheap, mid], {
      budget: '$$',
      tasteTags: [],
      vibes: [],
      anchor: null,
      coordsOf: () => null,
      hoursOf: () => null,
      dinnerAt: new Date(2026, 6, 25, 19, 0),
      recentRestaurantIds: [],
      savedPlaceKeys: [],
    });
    expect(ranked[0].item.id).toBe('mid');
  });

  it('applies no budget-fit score when budget is null, leaving other terms to decide order', () => {
    const cheap = restaurant({ id: 'cheap', price: '$' });
    const pricey = restaurant({ id: 'pricey', price: '$$$' });
    const ranked = rankRestaurants([cheap, pricey], {
      budget: null,
      tasteTags: [],
      vibes: [],
      anchor: null,
      coordsOf: () => null,
      hoursOf: () => null,
      dinnerAt: new Date(2026, 6, 25, 19, 0),
      recentRestaurantIds: [],
      savedPlaceKeys: [],
    });
    expect(ranked[0].score).toBe(0);
    expect(ranked[1].score).toBe(0);
  });

  it('demotes a spot that is closed at the planned dinner hour but still returns it', () => {
    const closedNow = restaurant({ id: 'closed', price: '$$' });
    const openNow = restaurant({ id: 'open', price: '$$' });
    const dinnerAt = new Date(2026, 6, 27, 19, 0); // Monday 7 PM
    const ranked = rankRestaurants([closedNow, openNow], {
      budget: '$$',
      tasteTags: [],
      vibes: [],
      anchor: null,
      coordsOf: () => null,
      hoursOf: (r) => (r.id === 'closed' ? 'Mo-Su 09:00-14:00' : 'Mo-Su 11:00-22:00'),
      dinnerAt,
      recentRestaurantIds: [],
      savedPlaceKeys: [],
    });
    expect(ranked[0].item.id).toBe('open');
    expect(ranked.map((r) => r.item.id)).toContain('closed'); // never dropped, just outscored
    const closedPick = ranked.find((r) => r.item.id === 'closed')!;
    expect(closedPick.reasons.some((r) => r.startsWith('Closed'))).toBe(true);
  });

  it('scores nearer candidates higher when an anchor is known', () => {
    const near = restaurant({ id: 'near', price: '$$' });
    const far = restaurant({ id: 'far', price: '$$' });
    const ranked = rankRestaurants([far, near], {
      budget: '$$',
      tasteTags: [],
      vibes: [],
      anchor: HERE,
      coordsOf: (r) => (r.id === 'near' ? NEAR : FAR),
      hoursOf: () => null,
      dinnerAt: new Date(),
      recentRestaurantIds: [],
      savedPlaceKeys: [],
    });
    expect(ranked[0].item.id).toBe('near');
  });

  it('demotes an excluded cuisine but still returns it', () => {
    const thai = restaurant({ id: 'thai', price: '$$', cuisine: 'Thai' });
    const other = restaurant({ id: 'other', price: '$$', cuisine: 'Italian' });
    const ranked = rankRestaurants([thai, other], {
      budget: null,
      tasteTags: [],
      vibes: [],
      anchor: null,
      coordsOf: () => null,
      hoursOf: () => null,
      dinnerAt: new Date(),
      recentRestaurantIds: [],
      savedPlaceKeys: [],
      exclusions: ['Thai'],
    });
    expect(ranked[0].item.id).toBe('other');
    expect(ranked.map((r) => r.item.id)).toContain('thai'); // never dropped
    const thaiPick = ranked.find((r) => r.item.id === 'thai')!;
    expect(thaiPick.reasons).toContain('You ruled out Thai');
    expect(thaiPick.score).toBeLessThan(0);
  });

  it('an exclusion that matches nothing leaves scores untouched', () => {
    const plain = restaurant({ id: 'plain', price: '$$', cuisine: 'Italian' });
    const ranked = rankRestaurants([plain], {
      budget: null,
      tasteTags: [],
      vibes: [],
      anchor: null,
      coordsOf: () => null,
      hoursOf: () => null,
      dinnerAt: new Date(),
      recentRestaurantIds: [],
      savedPlaceKeys: [],
      exclusions: ['Thai'],
    });
    expect(ranked[0].score).toBe(0);
    expect(ranked[0].reasons).toEqual([]);
  });

  it('penalizes a restaurant used the night before without dropping it', () => {
    const repeat = restaurant({ id: 'repeat', price: '$$' });
    const fresh = restaurant({ id: 'fresh', price: '$$' });
    const ranked = rankRestaurants([repeat, fresh], {
      budget: '$$',
      tasteTags: [],
      vibes: [],
      anchor: null,
      coordsOf: () => null,
      hoursOf: () => null,
      dinnerAt: new Date(),
      recentRestaurantIds: ['repeat'],
      savedPlaceKeys: [],
    });
    expect(ranked[0].item.id).toBe('fresh');
    expect(ranked.map((r) => r.item.id)).toContain('repeat');
  });

  it('credits a reservable restaurant for a date_night occasion', () => {
    const reservable = restaurant({ id: 'reservable', price: '$$', reserveUrl: 'https://example.com' });
    const plain = restaurant({ id: 'plain', price: '$$' });
    const ranked = rankRestaurants([plain, reservable], {
      budget: null, tasteTags: [], vibes: [], anchor: null, coordsOf: () => null, hoursOf: () => null,
      dinnerAt: new Date(), recentRestaurantIds: [], savedPlaceKeys: [], occasion: 'date_night',
    });
    expect(ranked[0].item.id).toBe('reservable');
  });

  it('credits real detailFacts text mentioning group dining for a group occasion', () => {
    const groupFriendly = restaurant({ id: 'group', price: '$$', detailFacts: [{ label: 'Service', value: 'group dining available' }] });
    const plain = restaurant({ id: 'plain', price: '$$' });
    const ranked = rankRestaurants([plain, groupFriendly], {
      budget: null, tasteTags: [], vibes: [], anchor: null, coordsOf: () => null, hoursOf: () => null,
      dinnerAt: new Date(), recentRestaurantIds: [], savedPlaceKeys: [], occasion: 'group',
    });
    expect(ranked[0].item.id).toBe('group');
  });

  it('clusters a restaurant sharing the anchor micro-district', () => {
    const same = restaurant({ id: 'same', price: '$$', address: '1700 Telegraph Ave, Oakland, CA' });
    const other = restaurant({ id: 'other', price: '$$', address: '3300 Lakeshore Ave, Oakland, CA' });
    const ranked = rankRestaurants([other, same], {
      budget: null, tasteTags: [], vibes: [], anchor: null, coordsOf: () => null, hoursOf: () => null,
      dinnerAt: new Date(), recentRestaurantIds: [], savedPlaceKeys: [], anchorMicroDistrict: 'uptown',
    });
    expect(ranked[0].item.id).toBe('same');
    expect(ranked[0].reasons).toContain('Same neighborhood as your event');
  });

  it('penalizes a cuisine repeated from the most recent night', () => {
    const thaiAgain = restaurant({ id: 'thai-again', price: '$$', cuisine: 'Thai' });
    const fresh = restaurant({ id: 'fresh', price: '$$', cuisine: 'Mexican' });
    const ranked = rankRestaurants([thaiAgain, fresh], {
      budget: null, tasteTags: [], vibes: [], anchor: null, coordsOf: () => null, hoursOf: () => null,
      dinnerAt: new Date(), recentRestaurantIds: [], savedPlaceKeys: [], recentCuisines: ['Thai'],
    });
    expect(ranked[0].item.id).toBe('fresh');
    expect(ranked.find((r) => r.item.id === 'thai-again')!.reasons).toContain('Same cuisine as last night');
  });

  it('climax night doubles the high-rating bonus', () => {
    const restaurantAt = (id: string, arcPosition?: 'middle' | 'climax') =>
      rankRestaurants([restaurant({ id, price: '$$', rating: 4.6 })], {
        budget: null, tasteTags: [], vibes: [], anchor: null, coordsOf: () => null, hoursOf: () => null,
        dinnerAt: new Date(), recentRestaurantIds: [], savedPlaceKeys: [], arcPosition,
      })[0].score;
    expect(restaurantAt('r', 'climax')).toBeGreaterThan(restaurantAt('r', 'middle'));
  });

  it('arrival and departure nights weight walk proximity more heavily than a middle night', () => {
    const HERE_POINT = { latitude: 37.8044, longitude: -122.2712 };
    const NEAR_POINT = { latitude: 37.805, longitude: -122.2712 };
    const scoreAt = (arcPosition?: 'middle' | 'arrival') =>
      rankRestaurants([restaurant({ id: 'r', price: '$$' })], {
        budget: null, tasteTags: [], vibes: [], anchor: HERE_POINT, coordsOf: () => NEAR_POINT, hoursOf: () => null,
        dinnerAt: new Date(), recentRestaurantIds: [], savedPlaceKeys: [], arcPosition,
      })[0].score;
    expect(scoreAt('arrival')).toBeGreaterThan(scoreAt('middle'));
  });
});

describe('microDistrictOf', () => {
  it('returns null for an unknown or empty address rather than guessing', () => {
    expect(microDistrictOf('')).toBeNull();
    expect(microDistrictOf(null)).toBeNull();
    expect(microDistrictOf('123 Nowhere St, Oakland, CA')).toBeNull();
  });

  it('resolves well-known single-district corridors', () => {
    expect(microDistrictOf('336 Water St, Oakland, CA')).toBe('jack_london');
    expect(microDistrictOf('3318 Lakeshore Ave, Oakland, CA')).toBe('grand_lake');
    expect(microDistrictOf('5403 College Ave, Oakland, CA')).toBe('rockridge');
  });

  it('splits Telegraph Ave by block number', () => {
    expect(microDistrictOf('1736 Telegraph Ave, Oakland, CA')).toBe('uptown');
    expect(microDistrictOf('5008 Telegraph Ave, Oakland, CA')).toBe('rockridge');
  });

  it('splits Broadway by block number', () => {
    expect(microDistrictOf('2295 Broadway, Oakland, CA')).toBe('uptown');
    expect(microDistrictOf('555 Broadway, Oakland, CA')).toBe('downtown_core');
  });
});

describe('rankNightlife', () => {
  it('clusters a nightlife spot sharing the anchor micro-district', () => {
    const same = { id: 'same', name: 'same', kind: 'Bar', hours: '', address: '1700 Telegraph Ave, Oakland, CA', desc: '', url: '' };
    const other = { id: 'other', name: 'other', kind: 'Bar', hours: '', address: '3300 Lakeshore Ave, Oakland, CA', desc: '', url: '' };
    const ranked = rankNightlife([other, same], { tasteTags: [], anchor: null, coordsOf: () => null, anchorMicroDistrict: 'uptown' });
    expect(ranked[0].item.id).toBe('same');
    expect(ranked[0].reasons).toContain('Same neighborhood as your night');
  });
});

describe('rankEvents · trip context', () => {
  // TRIP_CONTEXT_EFFECTS prints a concrete promise per option and says the
  // ranker has to honour it. These are that promise, checked.
  const landmark = event({ id: 'landmark', venueId: 'fox' });
  const other = event({ id: 'other', venueId: 'someplace' });
  const base = { tasteTags: [] as string[], vibes: [] as string[], weather: null, budget: null };

  it('raises a landmark venue for a visitor', () => {
    const ranked = rankEvents([other, landmark], { ...base, tripContext: 'visiting' });
    expect(ranked[0].item.id).toBe('landmark');
    expect(ranked[0].reasons).toContain('Oakland landmark');
  });

  it('lowers a landmark venue for a local, and says why', () => {
    const ranked = rankEvents([landmark, other], { ...base, tripContext: 'live' });
    expect(ranked[0].item.id).toBe('other');
    const landmarkPick = ranked.find((e) => e.item.id === 'landmark')!;
    expect(landmarkPick.reasons).toContain('Landmark — making room for newer places');
  });

  it('leaves the order alone for a work trip, which promises nothing about landmarks', () => {
    const ranked = rankEvents([other, landmark], { ...base, tripContext: 'work' });
    expect(ranked.every((pick) => !pick.reasons.some((r) => r.includes('landmark') || r.includes('Landmark')))).toBe(true);
  });

  it('leaves an event with no stated venue id alone', () => {
    const noVenue = event({ id: 'no-venue' });
    const ranked = rankEvents([noVenue], { ...base, tripContext: 'visiting' });
    expect(ranked[0].reasons).not.toContain('Oakland landmark');
  });

  it('does nothing without a trip context', () => {
    const withContext = rankEvents([landmark], { ...base, tripContext: 'visiting' })[0].score;
    const without = rankEvents([landmark], base)[0].score;
    expect(without).toBeLessThan(withContext);
  });
});

describe('rankEvents', () => {
  it('demotes an outdoor event when rain is forecast above the mention threshold', () => {
    const outdoor = event({ id: 'outdoor', cats: ['Outdoor'] });
    const indoor = event({ id: 'indoor', cats: [] });
    const rainy: WeatherHour = {
      startsAt: '', endsAt: '', temperatureF: 60, shortForecast: 'Rain',
      precipProbability: 70, windLabel: null, isDaytime: true,
    };
    const ranked = rankEvents([outdoor, indoor], { tasteTags: [], vibes: [], weather: rainy, budget: null });
    expect(ranked[0].item.id).toBe('indoor');
    const outdoorPick = ranked.find((e) => e.item.id === 'outdoor')!;
    expect(outdoorPick.reasons.some((r) => r.includes('rain'))).toBe(true);
  });

  it('does not penalize an outdoor pick under the rain threshold', () => {
    const outdoor = event({ id: 'outdoor', cats: ['Outdoor'] });
    const drizzle: WeatherHour = {
      startsAt: '', endsAt: '', temperatureF: 65, shortForecast: 'Cloudy',
      precipProbability: 10, windLabel: null, isDaytime: true,
    };
    const ranked = rankEvents([outdoor], { tasteTags: [], vibes: ['Outdoors'], weather: drizzle, budget: null });
    expect(ranked[0].reasons).toContain('Outdoors');
  });

  it('demotes an excluded vibe tag but still returns the event', () => {
    const jazz = event({ id: 'jazz', vibeTags: ['jazz'] });
    const rock = event({ id: 'rock', vibeTags: ['rock'] });
    const ranked = rankEvents([jazz, rock], { tasteTags: [], vibes: [], weather: null, budget: null, exclusions: ['jazz'] });
    expect(ranked[0].item.id).toBe('rock');
    expect(ranked.map((e) => e.item.id)).toContain('jazz');
    expect(ranked.find((e) => e.item.id === 'jazz')!.reasons).toContain('You ruled out jazz');
  });

  // A range like "$25–$60" is two numbers, not one — matching only the first
  // figure previously read a $60 show as a $25 one and never credited the
  // $$$ "Premium experience" bump a genuinely expensive show should get.
  it('reads a price range by its floor for budget-friendly and its ceiling for premium', () => {
    const rangedCheap = event({ id: 'ranged-cheap', priceLabel: '$25–$60' });
    const cheapBudget = rankEvents([rangedCheap], { tasteTags: [], vibes: [], weather: null, budget: '$' });
    expect(cheapBudget[0].reasons).toContain('Budget-friendly'); // floor ($25) qualifies

    const rangedPricey = event({ id: 'ranged-pricey', priceLabel: '$25–$60' });
    const highBudget = rankEvents([rangedPricey], { tasteTags: [], vibes: [], weather: null, budget: '$$$' });
    expect(highBudget[0].reasons).toContain('Premium experience'); // ceiling ($60) qualifies
  });

  it('a single-number price label is read as both its own floor and ceiling', () => {
    const flat = event({ id: 'flat', priceLabel: '$15' });
    const ranked = rankEvents([flat], { tasteTags: [], vibes: [], weather: null, budget: '$' });
    expect(ranked[0].reasons).toContain('Budget-friendly');
  });
});

describe('solveNight', () => {
  function pick<T extends { id: string }>(item: T, score = 0, reasons: string[] = []): ScoredPick<T> {
    return { item, score, reasons };
  }

  it('keeps the restaurant within the pace walk budget when a closer option exists', () => {
    const e = event({ id: 'show' });
    const near = restaurant({ id: 'near', price: '$$' });
    const far = restaurant({ id: 'far', price: '$$' });
    const result = solveNight({
      restaurants: [pick(far), pick(near)], // far ranks higher, near is still feasible
      events: [pick(e)],
      nightlife: null,
      coordsOfRestaurant: (r) => (r.id === 'near' ? NEAR : FAR),
      coordsOfEvent: () => HERE,
      coordsOfNightlife: () => null,
      pace: 'Relaxed',
      locked: {},
    });
    expect(result.restaurant?.id).toBe('near');
  });

  it('falls back to the top-ranked restaurant when nothing is within walk budget', () => {
    const e = event({ id: 'show' });
    const far1 = restaurant({ id: 'far1', price: '$$' });
    const far2 = restaurant({ id: 'far2', price: '$$' });
    const result = solveNight({
      restaurants: [pick(far1), pick(far2)],
      events: [pick(e)],
      nightlife: null,
      coordsOfRestaurant: () => FAR,
      coordsOfEvent: () => HERE,
      coordsOfNightlife: () => null,
      pace: 'Relaxed',
      locked: {},
    });
    expect(result.restaurant?.id).toBe('far1');
  });

  it('respects a locked restaurant regardless of ranking or distance', () => {
    const top = restaurant({ id: 'top', price: '$$' });
    const locked = restaurant({ id: 'locked', price: '$$' });
    const result = solveNight({
      restaurants: [pick(top, 10), pick(locked, 0)],
      events: [],
      nightlife: null,
      coordsOfRestaurant: () => null,
      coordsOfEvent: () => null,
      coordsOfNightlife: () => null,
      pace: 'Relaxed',
      locked: { restaurantId: 'locked' },
    });
    expect(result.restaurant?.id).toBe('locked');
  });

  it('avoids the currently-shown pick on regenerate when an alternative exists', () => {
    const shown = restaurant({ id: 'shown', price: '$$' });
    const alt = restaurant({ id: 'alt', price: '$$' });
    const result = solveNight({
      restaurants: [pick(shown, 5), pick(alt, 1)],
      events: [],
      nightlife: null,
      coordsOfRestaurant: () => null,
      coordsOfEvent: () => null,
      coordsOfNightlife: () => null,
      pace: 'Relaxed',
      locked: {},
      avoid: { restaurantId: 'shown' },
    });
    expect(result.restaurant?.id).toBe('alt');
  });

  // A seeded solve is how the concierge adapter reproduces "same sentence,
  // same plan" (concierge/adapter.ts's buildPlan) while every manual
  // Regenerate tap elsewhere keeps drawing from real Math.random().
  it('the same seed picks the same top-tier candidate every time', () => {
    const a = restaurant({ id: 'a', price: '$$' });
    const b = restaurant({ id: 'b', price: '$$' });
    const c = restaurant({ id: 'c', price: '$$' });
    const inputs = () => ({
      restaurants: [pick(a, 5), pick(b, 5), pick(c, 5)], // all within variety's 1.0 tier band
      events: [],
      nightlife: null,
      coordsOfRestaurant: () => null,
      coordsOfEvent: () => null,
      coordsOfNightlife: () => null,
      pace: 'Relaxed' as const,
      locked: {},
      variety: true,
      seed: 12345,
    });
    const first = solveNight(inputs());
    const second = solveNight(inputs());
    expect(first.restaurant?.id).toBe(second.restaurant?.id);
  });

  it('two different seeds are not forced to agree', () => {
    const a = restaurant({ id: 'a', price: '$$' });
    const b = restaurant({ id: 'b', price: '$$' });
    const c = restaurant({ id: 'c', price: '$$' });
    const d = restaurant({ id: 'd', price: '$$' });
    const picks = [pick(a, 5), pick(b, 5), pick(c, 5), pick(d, 5)];
    const results = new Set<string | undefined>();
    for (let seed = 0; seed < 20; seed += 1) {
      const result = solveNight({
        restaurants: picks,
        events: [],
        nightlife: null,
        coordsOfRestaurant: () => null,
        coordsOfEvent: () => null,
        coordsOfNightlife: () => null,
        pace: 'Relaxed',
        locked: {},
        variety: true,
        seed,
      });
      results.add(result.restaurant?.id);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('without a seed, variety still falls back to real randomness (unseeded calls are not forced to agree)', () => {
    const a = restaurant({ id: 'a', price: '$$' });
    const b = restaurant({ id: 'b', price: '$$' });
    const c = restaurant({ id: 'c', price: '$$' });
    const d = restaurant({ id: 'd', price: '$$' });
    const e = restaurant({ id: 'e', price: '$$' });
    const picks = [pick(a, 5), pick(b, 5), pick(c, 5), pick(d, 5), pick(e, 5)];
    const results = new Set<string | undefined>();
    for (let i = 0; i < 30; i += 1) {
      const result = solveNight({
        restaurants: picks,
        events: [],
        nightlife: null,
        coordsOfRestaurant: () => null,
        coordsOfEvent: () => null,
        coordsOfNightlife: () => null,
        pace: 'Relaxed',
        locked: {},
        variety: true,
      });
      results.add(result.restaurant?.id);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('computeDinnerTime', () => {
  it('defaults to 7 PM when there is no picked event', () => {
    const selectedDateAt = new Date(2026, 6, 25, 12, 0);
    const dinner = computeDinnerTime(null, selectedDateAt);
    expect(dinner.getHours()).toBe(19);
  });

  it('honours the trip-context default when there is no show to sit before', () => {
    const selectedDateAt = new Date(2026, 6, 25, 12, 0);
    // 'visiting' promises 6:30 so a show still fits; 'work' promises 6.
    const visiting = computeDinnerTime(null, selectedDateAt, null, 18 * 60 + 30);
    expect([visiting.getHours(), visiting.getMinutes()]).toEqual([18, 30]);
    const work = computeDinnerTime(null, selectedDateAt, null, 18 * 60);
    expect([work.getHours(), work.getMinutes()]).toEqual([18, 0]);
  });

  it('keeps the neutral 7 PM when no default is given', () => {
    const dinner = computeDinnerTime(null, new Date(2026, 6, 25, 12, 0), null, null);
    expect([dinner.getHours(), dinner.getMinutes()]).toEqual([19, 0]);
  });

  it('ignores the default once a real curtain time exists', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const dinner = computeDinnerTime(show, new Date(2026, 6, 25, 12, 0), null, 18 * 60);
    expect(dinner.getHours()).toBe(18);
    expect(dinner.getMinutes()).toBe(15); // still 105 min before the 8 PM show
  });

  it('places dinner before an evening show', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const dinner = computeDinnerTime(show, new Date(2026, 6, 25, 12, 0));
    expect(dinner.getTime()).toBeLessThan(new Date(show.startsAt!).getTime());
    expect(dinner.getHours()).toBe(18); // 105 min before 8 PM
    expect(dinner.getMinutes()).toBe(15);
  });

  it('places dinner after a matinee that leaves no sane pre-show window', () => {
    const matinee = event({ id: 'matinee', startsAt: '2026-07-25T11:00:00' });
    const dinner = computeDinnerTime(matinee, new Date(2026, 6, 25, 8, 0));
    expect(dinner.getTime()).toBeGreaterThan(new Date(matinee.startsAt!).getTime());
  });

  // A restaurant's real price tier is a proxy for how long the meal takes —
  // once one is picked, dinner should get more (or less) runway before an
  // evening show than the fixed pre-restaurant estimate.
  it('a $$$ restaurant gets a longer pre-show buffer than a $ one', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const fineDining = restaurant({ id: 'fine', price: '$$$' });
    const counterService = restaurant({ id: 'counter', price: '$' });
    const fineDinner = computeDinnerTime(show, new Date(2026, 6, 25, 12, 0), fineDining);
    const counterDinner = computeDinnerTime(show, new Date(2026, 6, 25, 12, 0), counterService);
    expect(fineDinner.getTime()).toBeLessThan(counterDinner.getTime()); // more runway = earlier dinner
    expect(fineDinner.getHours()).toBe(18);
    expect(fineDinner.getMinutes()).toBe(0); // 120 min before 8 PM
    expect(counterDinner.getHours()).toBe(19);
    expect(counterDinner.getMinutes()).toBe(0); // 60 min before 8 PM
  });

  it('omitting the restaurant keeps the original fixed 105-min estimate', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const dinner = computeDinnerTime(show, new Date(2026, 6, 25, 12, 0));
    expect(dinner.getHours()).toBe(18);
    expect(dinner.getMinutes()).toBe(15);
  });
});

describe('planStopOrder', () => {
  it('orders dinner before an evening event', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const r = restaurant({ id: 'r', price: '$$' });
    const { order } = planStopOrder(show, r, null, new Date(2026, 6, 25, 12, 0));
    expect(order).toEqual(['dinner', 'event']);
  });

  it('orders dinner after a matinee event', () => {
    const matinee = event({ id: 'matinee', startsAt: '2026-07-25T11:00:00' });
    const r = restaurant({ id: 'r', price: '$$' });
    const { order } = planStopOrder(matinee, r, null, new Date(2026, 6, 25, 8, 0));
    expect(order).toEqual(['event', 'dinner']);
  });

  it('always closes with nightlife when present', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const r = restaurant({ id: 'r', price: '$$' });
    const spot = nightlifeSpot({ id: 'spot' });
    const { order } = planStopOrder(show, r, spot, new Date(2026, 6, 25, 12, 0));
    expect(order).toEqual(['dinner', 'event', 'nightlife']);
  });

  it('reflects the solved restaurant\'s own dynamic dinner duration in dinnerAt', () => {
    const show = event({ id: 'show', startsAt: '2026-07-25T20:00:00' });
    const counterService = restaurant({ id: 'counter', price: '$' });
    const { dinnerTimeLabel } = planStopOrder(show, counterService, null, new Date(2026, 6, 25, 12, 0));
    expect(dinnerTimeLabel).toBe('7 PM'); // 60 min before 8 PM, not the fixed 105-min 6:15 PM
  });
});

describe('orderedLegs', () => {
  it('returns one leg per gap between ordered stops', () => {
    const points: Record<string, GeoPoint | null> = { dinner: HERE, event: NEAR, nightlife: null };
    const legs = orderedLegs(['dinner', 'event', 'nightlife'], (kind) => points[kind]);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatch(/min walk/);
    expect(legs[1]).toBeNull(); // nightlife coords unknown
  });
});

describe('rankHomeSections', () => {
  const base = { hasActiveStay: false, eventsCountToday: 0, matchedTasteTags: [] as string[], hasCollections: true };

  it('puts an active stay first', () => {
    const sections = rankHomeSections({ ...base, hasActiveStay: true, eventsCountToday: 3 });
    expect(sections[0].id).toBe('stay');
  });

  it('leads with events on a busy night and with food on a quiet one', () => {
    const busy = rankHomeSections({ ...base, eventsCountToday: 4 });
    expect(busy[0].id).toBe('events');

    const quiet = rankHomeSections({ ...base, eventsCountToday: 1 });
    expect(quiet[0].id).toBe('kitchens');
  });

  it('drops sections with nothing behind them rather than ranking them last', () => {
    const sections = rankHomeSections({ ...base, hasCollections: false });
    expect(sections.map((section) => section.id)).not.toContain('collections');
    expect(sections.map((section) => section.id)).not.toContain('events');
  });

  it('names the matched taste tags as the reason, and gives none when nothing matched', () => {
    expect(rankHomeSections({ ...base, matchedTasteTags: ['Thai'] }).find((s) => s.id === 'kitchens')?.reason).toBe(
      'Because you asked for Thai',
    );
    expect(rankHomeSections(base).find((section) => section.id === 'kitchens')?.reason).toBeNull();
  });
});

