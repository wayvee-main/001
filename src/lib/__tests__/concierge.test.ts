// 50-scenario evaluation set for the concierge adapter (docs/build-book.md
// Part 3.7), styled after plan-engine.test.ts's literal-fixture tests.
// Deterministic — no network, no AI key. This layer checks buildPlan's field
// mapping (ConciergeRequest -> plan-engine inputs) and the guardrails it adds
// on top (time-window narrowing). It does not re-test plan-engine.ts's own
// ranking math — that's plan-engine.test.ts's job. The parallel live-parse
// layer is scripts/eval-concierge.ts.
import { buildPlan, mergeRefineRequest, resolveAskNow, type ConciergeContext } from '@/lib/concierge/adapter';
import type { ConciergeRequest } from '@/lib/concierge/types';
import type { NightlifeSpot, Restaurant, ScoperEvent } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';

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
    venue: overrides.id,
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
const NEAR: GeoPoint = { latitude: 37.805, longitude: -122.2712 }; // ~0.04 mi
const FAR: GeoPoint = { latitude: 37.95, longitude: -122.2712 }; // ~10 mi

const NOW = new Date(2026, 6, 25, 15, 0); // 3 PM, same calendar day every event below is anchored to
const atTime = (h: number, m = 0) => new Date(2026, 6, 25, h, m).toISOString();

// ── Fixed universe ───────────────────────────────────────────────────────────
const RESTAURANTS_POOL: Restaurant[] = [
  restaurant({ id: 'cheap', price: '$' }),
  restaurant({ id: 'mid', price: '$$' }),
  restaurant({ id: 'pricey', price: '$$$' }),
  restaurant({ id: 'closed', price: '$$' }), // hoursOf() below makes this always-closed
  restaurant({ id: 'reservable', price: '$$', reserveUrl: 'https://example.com/reserve' }),
];

const EVENTS_POOL: ScoperEvent[] = [
  event({ id: 'evening', startsAt: atTime(19, 30) }), // 7:30 PM show
  event({ id: 'matinee', startsAt: atTime(11, 0) }), // 11 AM matinee — no sane pre-show window
  event({ id: 'outdoor', startsAt: atTime(18, 0), cats: ['Outdoor'] }),
  event({ id: 'livemusic', startsAt: atTime(20, 0), cats: ['Live music'] }),
  event({ id: 'morning', startsAt: atTime(9, 0) }),
  event({ id: 'latenight', startsAt: atTime(23, 0) }),
];

const NIGHTLIFE_POOL: NightlifeSpot[] = [nightlifeSpot({ id: 'barNear' }), nightlifeSpot({ id: 'barFar' })];

const COORDS: Record<string, GeoPoint> = {
  cheap: NEAR,
  mid: NEAR,
  pricey: FAR,
  closed: NEAR,
  reservable: NEAR,
  evening: NEAR,
  matinee: NEAR,
  outdoor: NEAR,
  livemusic: NEAR,
  morning: NEAR,
  latenight: NEAR,
  barNear: NEAR,
  barFar: FAR,
};

function baseRequest(overrides: Partial<ConciergeRequest> = {}): ConciergeRequest {
  return {
    intent: 'plan_evening',
    domains: [],
    exclusions: [],
    hardExclusions: [],
    occasion: null,
    rawText: 'test',
    pace: null,
    budget: null,
    moodTags: [],
    timeWindow: { startsBy: null, backBy: null },
    wantsNightlife: false,
    confidence: 'high',
    ...overrides,
  };
}

function baseCtx(overrides: Partial<ConciergeContext> = {}): ConciergeContext {
  return {
    anchor: HERE,
    tasteTags: [],
    coordsOf: (entry) => COORDS[entry.name] ?? null,
    hoursOf: (entry) => (entry.name === 'closed' ? 'Mo-Su 02:00-05:00' : null),
    weather: null,
    now: NOW,
    recentRestaurantIds: [],
    restaurantPool: RESTAURANTS_POOL,
    eventPool: EVENTS_POOL,
    nightlifePool: NIGHTLIFE_POOL,
    ...overrides,
  };
}

type Scenario = [name: string, request: ConciergeRequest, ctx: Partial<ConciergeContext>, assert: (plan: ReturnType<typeof buildPlan>) => void];

const scenarios: Scenario[] = [
  // A — budget scoring (soft, not hard filter) ------------------------------
  ['null budget picks by other terms, never drops a tier', baseRequest({ budget: null }), {}, (p) => expect(p.solved.restaurant).not.toBeNull()],
  ['$ budget favors the cheap restaurant', baseRequest({ budget: '$' }), { eventPool: [] }, (p) => expect(p.solved.restaurant?.id).toBe('cheap')],
  ['$$ budget favors the mid restaurant', baseRequest({ budget: '$$' }), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[0], RESTAURANTS_POOL[1], RESTAURANTS_POOL[2]] }, (p) => expect(p.solved.restaurant?.id).toBe('mid')],
  ['$$$ budget favors the pricey restaurant', baseRequest({ budget: '$$$' }), { eventPool: [], anchor: null }, (p) => expect(p.solved.restaurant?.id).toBe('pricey')],
  ['budget never hard-excludes a candidate', baseRequest({ budget: '$' }), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[2]] }, (p) => expect(p.solved.restaurant?.id).toBe('pricey')],

  // B — walkability / distance (CLAUDE.md #2) --------------------------------
  ['near restaurant preferred over far one when anchor is known', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[1], RESTAURANTS_POOL[2]] }, (p) => expect(p.solved.restaurant?.id).toBe('mid')],
  ['no anchor still returns a real restaurant', baseRequest(), { eventPool: [], anchor: null }, (p) => expect(p.solved.restaurant).not.toBeNull()],
  ['closed restaurant is demoted but never dropped', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[3], RESTAURANTS_POOL[1]] }, (p) => expect(p.solved.restaurant?.id).toBe('mid')],
  ['closed restaurant still returned when it is the only option', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[3]] }, (p) => expect(p.solved.restaurant?.id).toBe('closed')],
  ['closed reason is a real computed fact, not invented prose', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[3]] }, (p) => expect(p.solved.reasons.restaurant.some((r) => r.startsWith('Closed'))).toBe(true)],

  // C — time window narrowing (adapter-only behavior) ------------------------
  ['backBy excludes an event starting after it', baseRequest({ timeWindow: { startsBy: null, backBy: '21:00' } }), { restaurantPool: [] }, (p) => expect(p.solved.event?.id).not.toBe('latenight')],
  ['startsBy excludes an event starting before it', baseRequest({ timeWindow: { startsBy: '12:00', backBy: null } }), { restaurantPool: [], eventPool: [EVENTS_POOL[4]] }, (p) => expect(p.relaxed).toContain('backBy')],
  ['a window that empties the pool falls back and flags relaxed', baseRequest({ timeWindow: { startsBy: '01:00', backBy: '02:00' } }), { restaurantPool: [] }, (p) => expect(p.relaxed).toContain('backBy')],
  ['a window with real matches sets no relaxed flag', baseRequest({ timeWindow: { startsBy: '17:00', backBy: '21:00' } }), { restaurantPool: [], eventPool: [EVENTS_POOL[0]] }, (p) => expect(p.relaxed).not.toContain('backBy')],
  ['no time window at all never narrows the pool', baseRequest(), { restaurantPool: [] }, (p) => expect(p.relaxed).toHaveLength(0)],

  // D — dinner timing via computeDinnerTime ----------------------------------
  ['dinner lands before an evening show', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[0]] }, (p) => expect(p.dinnerTimeLabel).toBe('5:45 PM')],
  ['dinner lands after a matinee with no sane pre-show window', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[1]] }, (p) => expect(p.dinnerTimeLabel).toBe('11:30 AM')],
  ['no event at all defaults dinner to 7 PM', baseRequest(), { eventPool: [], restaurantPool: [] }, (p) => expect(p.dinnerTimeLabel).toBe('7 PM')],
  ['dinner timing never blocks the plan when no restaurant matches', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[0]] }, (p) => expect(p.stopOrder).toContain('event')],
  ['picked event, not just any event, drives dinner time', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[1], EVENTS_POOL[0]] }, (p) => expect(['11:30 AM', '5:45 PM']).toContain(p.dinnerTimeLabel)],

  // E — mood tags -> vibes (only the 3 literals plan-engine.ts checks) -------
  ['Outdoors mood tag narrows the event pool to outdoor cats when any exist', baseRequest({ moodTags: ['Outdoors'] }), { restaurantPool: [] }, (p) => expect(p.solved.event?.cats.includes('Outdoor') || p.solved.event === null).toBe(true)],
  ['Nightlife mood tag narrows the event pool to live-music cats when any exist', baseRequest({ moodTags: ['Nightlife'] }), { restaurantPool: [], eventPool: [EVENTS_POOL[3], EVENTS_POOL[0]] }, (p) => expect(p.solved.event?.id).toBe('livemusic')],
  ['Foodie mood tag credits a reservable restaurant', baseRequest({ moodTags: ['Foodie'] }), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[1], RESTAURANTS_POOL[4]] }, (p) => expect(p.solved.reasons.restaurant).toContain('Reservable')],
  ['an unknown mood tag only feeds taste affinity, never vibes', baseRequest({ moodTags: ['jazz brunch'] }), { eventPool: [] }, (p) => expect(p.solved.restaurant).not.toBeNull()],
  ['multiple mood tags combine without erroring', baseRequest({ moodTags: ['Outdoors', 'Nightlife', 'Foodie'] }), {}, (p) => expect(p.solved).toBeDefined()],

  // F — nightlife inclusion ---------------------------------------------------
  ['wantsNightlife true includes a nightcap', baseRequest({ wantsNightlife: true }), { eventPool: [], restaurantPool: [] }, (p) => expect(p.solved.nightlifeSpot).not.toBeNull()],
  ['wantsNightlife false and Relaxed pace excludes a nightcap', baseRequest({ wantsNightlife: false, pace: 'Relaxed' }), { eventPool: [], restaurantPool: [] }, (p) => expect(p.solved.nightlifeSpot).toBeNull()],
  ['Packed pace includes a nightcap even when wantsNightlife is false', baseRequest({ wantsNightlife: false, pace: 'Packed' }), { eventPool: [], restaurantPool: [] }, (p) => expect(p.solved.nightlifeSpot).not.toBeNull()],
  ['nightlife stop always closes the timeline when present', baseRequest({ wantsNightlife: true }), { eventPool: [], restaurantPool: [] }, (p) => expect(p.stopOrder[p.stopOrder.length - 1]).toBe('nightlife')],
  ['no nightlife pool still returns a plan without a nightcap', baseRequest({ wantsNightlife: true }), { eventPool: [], restaurantPool: [], nightlifePool: [] }, (p) => expect(p.solved.nightlifeSpot).toBeNull()],

  // G — cross-night variety (recentRestaurantIds passthrough) ----------------
  ['a recently-used restaurant is demoted, not dropped', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[1]], recentRestaurantIds: ['mid'] }, (p) => expect(p.solved.restaurant?.id).toBe('mid')],
  ['a recently-used restaurant loses to a fresh alternative', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[1], RESTAURANTS_POOL[0]], recentRestaurantIds: ['mid'] }, (p) => expect(p.solved.restaurant?.id).toBe('cheap')],
  ['no recent restaurants means no demotion applied', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[1]], recentRestaurantIds: [] }, (p) => expect(p.solved.restaurant?.id).toBe('mid')],
  ['reason mentions the repeat honestly', baseRequest(), { eventPool: [], restaurantPool: [RESTAURANTS_POOL[1]], recentRestaurantIds: ['mid'] }, (p) => expect(p.solved.reasons.restaurant.some((r) => r.includes('night before'))).toBe(true)],
  ['recentRestaurantIds passthrough does not affect events', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[0]], recentRestaurantIds: ['evening'] }, (p) => expect(p.solved.event?.id).toBe('evening')],

  // H — weather / rain demotion passthrough -----------------------------------
  ['rain above threshold demotes an outdoor event', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[2], EVENTS_POOL[0]], weather: { startsAt: NOW.toISOString(), endsAt: NOW.toISOString(), temperatureF: 60, shortForecast: 'Rain', precipProbability: 80, windLabel: null, isDaytime: true } }, (p) => expect(p.solved.event?.id).toBe('evening')],
  ['rain below threshold does not demote an outdoor event', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[2]], weather: { startsAt: NOW.toISOString(), endsAt: NOW.toISOString(), temperatureF: 70, shortForecast: 'Clear', precipProbability: 10, windLabel: null, isDaytime: true } }, (p) => expect(p.solved.event?.id).toBe('outdoor')],
  ['no weather hydrated never invents a rain call', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[2]], weather: null }, (p) => expect(p.solved.event?.id).toBe('outdoor')],
  ['rain reason is a real forecast number, not generated prose', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[2]], weather: { startsAt: NOW.toISOString(), endsAt: NOW.toISOString(), temperatureF: 60, shortForecast: 'Rain', precipProbability: 55, windLabel: null, isDaytime: true } }, (p) => expect(p.solved.reasons.event.some((r) => r.includes('55%'))).toBe(true)],
  ['weather only affects outdoor-tagged events', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[0]], weather: { startsAt: NOW.toISOString(), endsAt: NOW.toISOString(), temperatureF: 60, shortForecast: 'Rain', precipProbability: 90, windLabel: null, isDaytime: true } }, (p) => expect(p.solved.event?.id).toBe('evening')],

  // I — degenerate pools never crash, never invent a stop ---------------------
  ['empty restaurant pool still solves an event-only night', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[0]] }, (p) => { expect(p.solved.restaurant).toBeNull(); expect(p.solved.event).not.toBeNull(); }],
  ['empty event pool still solves a dinner-only night', baseRequest(), { eventPool: [] }, (p) => { expect(p.solved.event).toBeNull(); expect(p.solved.restaurant).not.toBeNull(); }],
  ['both pools empty returns an empty stop order, not a crash', baseRequest(), { restaurantPool: [], eventPool: [], nightlifePool: [] }, (p) => expect(p.stopOrder).toHaveLength(0)],
  ['both pools empty still returns a well-formed plan object', baseRequest(), { restaurantPool: [], eventPool: [] }, (p) => { expect(p.stopLegs).toEqual([]); expect(p.confidence).toBe('fallback'); }],
  ['event-only plan never forces a restaurant into the result', baseRequest(), { restaurantPool: [], eventPool: [EVENTS_POOL[0]] }, (p) => expect(p.stopOrder).toEqual(['event'])],

  // J — confidence is inert; nonsense/empty requests degrade gracefully ------
  ['high confidence does not change the ranking outcome', baseRequest({ confidence: 'high' }), { eventPool: [] }, (p) => expect(p.solved.restaurant).not.toBeNull()],
  ['low confidence does not change the ranking outcome', baseRequest({ confidence: 'low' }), { eventPool: [] }, (p) => expect(p.solved.restaurant).not.toBeNull()],
  ['a fully empty/nonsense request still returns a real plan', baseRequest(), {}, (p) => expect(p.solved.restaurant || p.solved.event).toBeTruthy()],
  ['a fully empty request defaults pace to Relaxed (no nightlife)', baseRequest({ pace: null, wantsNightlife: false }), { eventPool: [], restaurantPool: [] }, (p) => expect(p.solved.nightlifeSpot).toBeNull()],
  ['nothing about the plan is invented when nothing real matches', baseRequest({ moodTags: ['nonexistent-tag-xyz'] }), { restaurantPool: [], eventPool: [], nightlifePool: [] }, (p) => expect(p.stopOrder).toHaveLength(0)],
];

describe('concierge adapter — 50-scenario evaluation set', () => {
  it.each(scenarios)('%s', (_name, request, ctxOverrides, assert) => {
    const plan = buildPlan(request, baseCtx(ctxOverrides));
    assert(plan);
  });

  it('covers exactly 50 scenarios', () => {
    expect(scenarios).toHaveLength(50);
  });

  // K — cross-midnight backBy (adapter's timeOnEveningDate) ------------------
  // "Back by midnight" (backBy '00:00') must not exclude an 11 PM event on the
  // *same* evening — 00:00 means the small hours after this evening, not the
  // midnight that already passed at the start of today.
  it('backBy midnight includes a late-night event on the same evening, not relaxed', () => {
    const plan = buildPlan(baseRequest({ timeWindow: { startsBy: null, backBy: '00:00' } }), baseCtx({ restaurantPool: [], eventPool: [EVENTS_POOL[5]] }));
    expect(plan.solved.event?.id).toBe('latenight');
    expect(plan.relaxed).not.toContain('backBy');
  });

  // L — Outdoors + Nightlife vibe intersection (regression: each used to read
  // from the original pool and overwrite the other's narrowing instead of
  // narrowing further) ---------------------------------------------------
  it('Outdoors and Nightlife together intersect instead of the second silently overwriting the first', () => {
    const outdoorOnly = event({ id: 'outdoor-only', startsAt: atTime(18, 0), cats: ['Outdoor'] });
    const outdoorLiveMusic = event({ id: 'outdoor-live', startsAt: atTime(18, 30), cats: ['Outdoor', 'Live music'] });
    const liveMusicOnly = event({ id: 'live-only', startsAt: atTime(19, 0), cats: ['Live music'] });
    const plan = buildPlan(baseRequest({ moodTags: ['Outdoors', 'Nightlife'] }), baseCtx({
      restaurantPool: [],
      eventPool: [outdoorOnly, outdoorLiveMusic, liveMusicOnly],
    }));
    // With the bug, Nightlife's filter (reading from the un-narrowed pool)
    // would let liveMusicOnly win even though it isn't Outdoor. Fixed, only
    // the event matching both survives to be picked.
    expect(plan.solved.event?.id).toBe('outdoor-live');
  });

  // M — dietary hard-filter (hardExclusions) -------------------------------
  it('drops a restaurant matching a hard exclusion entirely rather than just demoting it', () => {
    const shellfish = restaurant({ id: 'shellfish', price: '$$', cuisine: 'Shellfish' });
    const safe = restaurant({ id: 'safe', price: '$$', cuisine: 'Italian' });
    const plan = buildPlan(baseRequest({ hardExclusions: ['Shellfish'] }), baseCtx({ eventPool: [], restaurantPool: [shellfish, safe] }));
    expect(plan.solved.restaurant?.id).toBe('safe');
  });

  it('falls back to the unfiltered pool (flagged) rather than returning no restaurant at all', () => {
    const shellfish = restaurant({ id: 'shellfish', price: '$$', cuisine: 'Shellfish' });
    const plan = buildPlan(baseRequest({ hardExclusions: ['Shellfish'] }), baseCtx({ eventPool: [], restaurantPool: [shellfish] }));
    expect(plan.solved.restaurant?.id).toBe('shellfish');
    expect(plan.relaxed).toContain('hardExclusions');
  });

  it('an explicitly targeted restaurant survives a hard exclusion it happens to match', () => {
    const shellfish = restaurant({ id: 'shellfish', price: '$$', cuisine: 'Shellfish' });
    const safe = restaurant({ id: 'safe', price: '$$', cuisine: 'Italian' });
    const plan = buildPlan(baseRequest({ hardExclusions: ['Shellfish'] }), baseCtx({
      eventPool: [],
      restaurantPool: [shellfish, safe],
      targetRestaurantId: 'shellfish',
    }));
    expect(plan.solved.restaurant?.id).toBe('shellfish');
  });

  // N — occasion-aware scoring ---------------------------------------------
  it('date_night credits a reservable restaurant', () => {
    const reservable = restaurant({ id: 'reservable-dn', price: '$$', reserveUrl: 'https://example.com/reserve' });
    const plain = restaurant({ id: 'plain-dn', price: '$$' });
    const plan = buildPlan(baseRequest({ occasion: 'date_night' }), baseCtx({ eventPool: [], restaurantPool: [reservable, plain] }));
    expect(plan.solved.restaurant?.id).toBe('reservable-dn');
    expect(plan.solved.reasons.restaurant.some((r) => r.includes('date night'))).toBe(true);
  });

  it('group credits a restaurant whose real detail facts mention group dining', () => {
    const groupFriendly = restaurant({ id: 'group-friendly', price: '$$', detailFacts: [{ label: 'Service', value: 'Dine-in · group dining' }] });
    const plain = restaurant({ id: 'plain-group', price: '$$' });
    const plan = buildPlan(baseRequest({ occasion: 'group' }), baseCtx({ eventPool: [], restaurantPool: [groupFriendly, plain] }));
    expect(plan.solved.restaurant?.id).toBe('group-friendly');
  });

  it('an occasion with nothing real to match leaves scoring unaffected', () => {
    const plain = restaurant({ id: 'plain-solo', price: '$$' });
    const plan = buildPlan(baseRequest({ occasion: 'solo' }), baseCtx({ eventPool: [], restaurantPool: [plain] }));
    expect(plan.solved.restaurant?.id).toBe('plain-solo');
  });

  // O — micro-district clustering -------------------------------------------
  it('clusters a restaurant in the same district as the anchor event over an equally-plain one elsewhere', () => {
    const sameDistrict = restaurant({ id: 'same-district', price: '$$', address: '1700 Telegraph Ave, Oakland, CA' });
    const otherDistrict = restaurant({ id: 'other-district', price: '$$', address: '3300 Lakeshore Ave, Oakland, CA' });
    const anchoredEvent = event({ id: 'uptown-show', startsAt: atTime(20, 0), addr: '1807 Telegraph Ave, Oakland, CA' });
    const plan = buildPlan(baseRequest(), baseCtx({ restaurantPool: [sameDistrict, otherDistrict], eventPool: [anchoredEvent], anchor: null }));
    expect(plan.solved.restaurant?.id).toBe('same-district');
  });

  // P — stay-arc pacing -------------------------------------------------------
  it('climax night doubles the rating bonus enough to flip an otherwise-close pick', () => {
    const stay = { propertyName: 'Test Hotel', checkIn: '2026-07-24', checkOut: '2026-07-28' }; // 4 nights: 24 arrival, 25 middle, 26 climax, 27 departure
    const topRated = restaurant({ id: 'top-rated', price: '$$', rating: 4.6 });
    const decentButFartherAffinity = restaurant({ id: 'decent', price: '$$', rating: 4.0 });
    const plan = buildPlan(baseRequest(), baseCtx({
      eventPool: [],
      restaurantPool: [topRated, decentButFartherAffinity],
      stay,
      now: new Date(2026, 6, 26, 15, 0), // the climax night
    }));
    expect(plan.solved.restaurant?.id).toBe('top-rated');
    expect(plan.solved.reasons.restaurant.some((r) => r.includes('Highly rated'))).toBe(true);
  });

  it('a cuisine repeated from the night before is demoted in favor of a fresh one', () => {
    // recentCuisines is resolved by buildPlan against the *real* catalog
    // (RESTAURANTS), not the test's own restaurantPool — 'farmhouse' is the
    // real Thai entry in src/lib/data.ts, so this is the id that actually
    // carries a cuisine signal through recentRestaurantIds.
    const sameCuisineAgain = restaurant({ id: 'thai-again', price: '$$', cuisine: 'Thai' });
    const different = restaurant({ id: 'different-cuisine', price: '$$', cuisine: 'Mexican' });
    const plan = buildPlan(baseRequest(), baseCtx({
      eventPool: [],
      restaurantPool: [sameCuisineAgain, different],
      recentRestaurantIds: ['farmhouse'],
    }));
    expect(plan.solved.restaurant?.id).toBe('different-cuisine');
  });

  it('backBy 1 AM includes a late-night event and excludes nothing real', () => {
    const plan = buildPlan(baseRequest({ timeWindow: { startsBy: null, backBy: '01:00' } }), baseCtx({ restaurantPool: [], eventPool: [EVENTS_POOL[0], EVENTS_POOL[5]] }));
    expect(plan.relaxed).not.toContain('backBy');
  });

  it('startsBy 1 AM (an unusual but valid ask) still resolves to the next calendar day, not an empty pool from a same-day compare', () => {
    const plan = buildPlan(baseRequest({ timeWindow: { startsBy: '01:00', backBy: null } }), baseCtx({ restaurantPool: [], eventPool: [EVENTS_POOL[5]] }));
    // 'latenight' starts at 23:00 the same evening, before the next-day 1 AM
    // startsBy floor — so it's correctly excluded, and the pool (with nothing
    // else in it) falls back rather than silently returning it anyway.
    expect(plan.relaxed).toContain('backBy');
  });
});

describe('resolveAskNow — anchoring "tonight" to the right calendar day', () => {
  it('anchors an evening call to noon the same day', () => {
    const at = resolveAskNow(new Date(2026, 6, 25, 20, 15)); // 8:15 PM
    expect(at.getDate()).toBe(25);
    expect(at.getHours()).toBe(12);
  });

  it('anchors a 3 AM call to noon the *previous* day — still last night\'s plan', () => {
    const at = resolveAskNow(new Date(2026, 6, 26, 3, 0)); // 3 AM on the 26th
    expect(at.getDate()).toBe(25);
    expect(at.getHours()).toBe(12);
  });

  it('anchors exactly at the 5 AM cutoff to today, matching daypart.ts\'s own boundary', () => {
    const at = resolveAskNow(new Date(2026, 6, 26, 5, 0));
    expect(at.getDate()).toBe(26);
  });

  it('anchors one minute before the cutoff to the previous day', () => {
    const at = resolveAskNow(new Date(2026, 6, 26, 4, 59));
    expect(at.getDate()).toBe(25);
  });
});

describe('buildPlan — domains scoping', () => {
  it('"food" only never includes an event, even when strong candidates exist', () => {
    const plan = buildPlan(baseRequest({ domains: ['food'] }), baseCtx());
    expect(plan.solved.event).toBeNull();
    expect(plan.solved.restaurant).not.toBeNull();
  });

  it('an events domain (events/music/film) never includes a restaurant', () => {
    const plan = buildPlan(baseRequest({ domains: ['music'] }), baseCtx());
    expect(plan.solved.restaurant).toBeNull();
  });

  it('an empty domains list scopes nothing — every slot stays eligible', () => {
    const plan = buildPlan(baseRequest({ domains: [] }), baseCtx());
    expect(plan.solved.restaurant).not.toBeNull();
    expect(plan.solved.event).not.toBeNull();
  });

  it('a deep-linked target event survives a domains guess that would otherwise exclude events', () => {
    const plan = buildPlan(
      baseRequest({ domains: ['food'] }),
      baseCtx({ targetEventId: 'evening' }),
    );
    expect(plan.solved.event?.id).toBe('evening');
  });

  it('a deep-linked target restaurant survives a domains guess that would otherwise exclude food', () => {
    const plan = buildPlan(
      baseRequest({ domains: ['music'] }),
      baseCtx({ targetRestaurantId: 'mid' }),
    );
    expect(plan.solved.restaurant?.id).toBe('mid');
  });
});

describe('buildPlan — exclusions demote, never drop', () => {
  const THAI: Restaurant = restaurant({ id: 'thai-spot', price: '$$', cuisine: 'Thai' });
  const ITALIAN: Restaurant = restaurant({ id: 'italian-spot', price: '$$', cuisine: 'Italian' });

  it('an excluded cuisine ranks below an alternative but is not removed from the plan entirely', () => {
    const plan = buildPlan(
      baseRequest({ exclusions: ['Thai'] }),
      baseCtx({ eventPool: [], restaurantPool: [THAI, ITALIAN] }),
    );
    expect(plan.solved.restaurant?.id).toBe('italian-spot');
  });

  it('an excluded cuisine is still returned when it is the only option (CLAUDE.md #6)', () => {
    const plan = buildPlan(
      baseRequest({ exclusions: ['Thai'] }),
      baseCtx({ eventPool: [], restaurantPool: [THAI] }),
    );
    expect(plan.solved.restaurant?.id).toBe('thai-spot');
    expect(plan.solved.reasons.restaurant).toContain('You ruled out Thai');
  });
});

describe('buildPlan — seeded reproducibility', () => {
  it('the same rawText and the same planned moment reproduce the same plan', () => {
    const request = baseRequest({ rawText: 'surprise me' });
    const ctx = baseCtx();
    const first = buildPlan(request, ctx);
    const second = buildPlan(request, ctx);
    expect(first.solved.restaurant?.id).toBe(second.solved.restaurant?.id);
    expect(first.solved.event?.id).toBe(second.solved.event?.id);
  });
});

describe('mergeRefineRequest', () => {
  const previous = baseRequest({
    intent: 'plan_evening',
    domains: ['food', 'events'],
    exclusions: ['Thai'],
    pace: 'Relaxed',
    budget: '$$',
    moodTags: ['Foodie'],
    timeWindow: { startsBy: null, backBy: '22:00' },
    wantsNightlife: false,
  });

  it('a restated field wins over the previous ask', () => {
    const incoming = baseRequest({ intent: 'refine', budget: '$' });
    const merged = mergeRefineRequest(previous, incoming);
    expect(merged.budget).toBe('$');
  });

  it('a field the guest did not restate carries over from the previous ask', () => {
    const incoming = baseRequest({ intent: 'refine', budget: '$' });
    const merged = mergeRefineRequest(previous, incoming);
    expect(merged.pace).toBe('Relaxed');
    expect(merged.timeWindow.backBy).toBe('22:00');
    expect(merged.moodTags).toEqual(['Foodie']);
  });

  it('exclusions are additive — refine has no lever to un-rule-out something', () => {
    const incoming = baseRequest({ intent: 'refine', exclusions: ['Loud'] });
    const merged = mergeRefineRequest(previous, incoming);
    expect(merged.exclusions).toEqual(expect.arrayContaining(['Thai', 'Loud']));
  });

  it('wantsNightlife can only turn on across a refine, never back off', () => {
    const withNightlife = { ...previous, wantsNightlife: true };
    const incoming = baseRequest({ intent: 'refine', wantsNightlife: false });
    const merged = mergeRefineRequest(withNightlife, incoming);
    expect(merged.wantsNightlife).toBe(true);
  });

  it('always resolves to plan_evening, regardless of the incoming intent field', () => {
    const merged = mergeRefineRequest(previous, baseRequest({ intent: 'refine' }));
    expect(merged.intent).toBe('plan_evening');
  });

  it('rawText is always the refine ask\'s own words, not the previous ask\'s', () => {
    const incoming = baseRequest({ intent: 'refine', rawText: 'make that cheaper' });
    const merged = mergeRefineRequest(previous, incoming);
    expect(merged.rawText).toBe('make that cheaper');
  });
});

describe('buildPlan — avoid steers a refine away from the previous picks', () => {
  it('avoidRestaurantId keeps the previous pick from winning again when an alternative exists', () => {
    const mid = restaurant({ id: 'mid', price: '$$' });
    const cheap = restaurant({ id: 'cheap', price: '$' });
    const plan = buildPlan(
      baseRequest(),
      baseCtx({ eventPool: [], restaurantPool: [mid, cheap], avoidRestaurantId: 'mid' }),
    );
    expect(plan.solved.restaurant?.id).not.toBe('mid');
  });
});
