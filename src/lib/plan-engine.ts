// Scoring + joint-feasibility engine behind "Plan my stay" (src/app/(tabs)/create.tsx).
//
// Replaces "first item in an already-filtered array" with real ranking: taste
// affinity, walkability (CLAUDE.md #2 — distance is the primary sort, not a
// filter), open-now at the actual planned hour (CLAUDE.md #3 — "right now" is
// live), and weather. Every reason a candidate scores where it does is a real
// computed fact off catalog fields — never generated text — so the "why" line
// callers render can't invent anything (CLAUDE.md: no invented data).
//
// A candidate is never hard-dropped for being closed, too far, or rained on —
// only outscored. If every restaurant is closed, the top-ranked one still
// comes back, honestly labeled "Closed at that time" rather than an empty
// screen (CLAUDE.md #6 — never breaks).

import { LANDMARK_VENUE_IDS, type TripContext } from '@/lib/arrival';
import type { NightlifeSpot, Restaurant, ScoperEvent } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';
import { milesBetween, walkMinutes } from '@/lib/geo';
import { clockLabel, openStateFor } from '@/lib/hours';
import { mulberry32 } from '@/lib/rng';
import type { Occasion } from '@/lib/concierge/enums';
import type { StayArcPosition } from '@/lib/stay';
import { affinityScore, eventHaystack, normalize, restaurantHaystack, tagMatches } from '@/lib/taste';
import type { BudgetPreference, PacePreference } from '@/lib/user-data';
import type { WeatherHour } from '@/lib/weather';

export interface ScoredPick<T> {
  item: T;
  score: number;
  reasons: string[];
}

/** Max comfortable one-way walk between consecutive stops, by declared pace.
 * A Relaxed night keeps everything close; Packed accepts a longer crossing. */
export const PACE_WALK_BUDGET_MIN: Record<PacePreference, number> = { Relaxed: 12, Packed: 20 };


const BUDGET_ORDER: BudgetPreference[] = ['$', '$$', '$$$'];

export type MicroDistrict = 'uptown' | 'jack_london' | 'grand_lake' | 'rockridge' | 'downtown_core';

/** Derived from an entry's own already-verified street address — never a
 * hand-tagged catalog field, so there's nothing to keep in sync or drift from
 * the address itself. Coverage is deliberately partial: an address outside
 * these well-known corridors (or a corridor split across districts, resolved
 * here by block number) returns null rather than a guessed bucket, and every
 * caller treats null as "no district signal" — no bonus, never a mismatch
 * penalty. Telegraph Ave and Broadway each cross two of these districts along
 * their length, so those two are block-number aware; the rest are single-district
 * streets end to end. */
export function microDistrictOf(address: string | null | undefined): MicroDistrict | null {
  if (!address) return null;
  const blockMatch = address.match(/^(\d+)/);
  const block = blockMatch ? Number(blockMatch[1]) : null;

  if (/water st|embarcadero/i.test(address)) return 'jack_london';
  if (/lakeshore ave|grand ave/i.test(address)) return 'grand_lake';
  if (/college ave|piedmont ave/i.test(address)) return 'rockridge';
  // Telegraph Ave: Uptown below ~3000, Temescal/Rockridge border above —
  // there's no Temescal bucket in this fixed 5-district set, so the higher
  // block grouping is an approximation, not a verified boundary.
  if (/telegraph ave/i.test(address)) return block !== null && block >= 3000 ? 'rockridge' : 'uptown';
  // Broadway: Old Oakland/City Center below ~1300, Uptown above.
  if (/broadway/i.test(address)) return block !== null && block < 1300 ? 'downtown_core' : 'uptown';
  if (/webster st|franklin st|\b(?:8th|9th|12th|13th|17th) st\b/i.test(address)) return 'downtown_core';
  return null;
}

function budgetFitScore(price: string, budget: BudgetPreference | null): number {
  if (budget === null) return 0;
  const priceIndex = BUDGET_ORDER.indexOf(price as BudgetPreference);
  if (priceIndex === -1) return 0;
  const diff = Math.abs(priceIndex - BUDGET_ORDER.indexOf(budget));
  if (diff === 0) return 2;
  if (diff === 1) return 0.5;
  return 0;
}

export interface RestaurantContext {
  /** null when the guest expressed no budget preference — plan-engine.ts then
   * skips budget-fit scoring entirely rather than penalizing any price tier. */
  budget: BudgetPreference | null;
  tasteTags: string[];
  vibes: string[];
  anchor: GeoPoint | null;
  coordsOf: (restaurant: Restaurant) => GeoPoint | null;
  hoursOf: (restaurant: Restaurant) => string | null;
  /** The moment dinner would actually happen tonight — from computeDinnerTime. */
  dinnerAt: Date;
  /** Restaurant ids already used on other nights of this stay, most recent
   * first — repeats are scored down, never dropped (CLAUDE.md #4: varied). */
  recentRestaurantIds: string[];
  savedPlaceKeys: string[];
  /** Things the guest ruled out ("not thai") — members of tasteVocabulary(),
   * same guardrail as moodTags. Scored down (AFFINITY_WEIGHTS.excluded-sized),
   * never dropped: CLAUDE.md #2 treats distance as a sort key, not a filter,
   * and an exclusion is the same kind of preference. */
  exclusions?: string[];
  /** The kind of evening this is, from the guest's own sentence. Scoring only
   * ever reads real, already-verified restaurant facts (reserveUrl,
   * detailFacts text) against it — never a fabricated "romantic" label. */
  occasion?: Occasion | null;
  /** The anchor event/venue's own district (microDistrictOf), when known —
   * a restaurant in the same district gets a walkable-cluster bonus on top of
   * (not instead of) the raw walk-minutes score. */
  anchorMicroDistrict?: MicroDistrict | null;
  /** Where tonight falls in a linked stay's arc — shifts which signals matter
   * (arrival/departure lean on proximity, climax leans on rating/splurge).
   * Defaults to 'middle' (today's flat weighting) when there's no stay. */
  arcPosition?: StayArcPosition;
  /** Cuisines of recent nights, most recent first — same ids as
   * recentRestaurantIds, just resolved to their cuisine by the caller (this
   * module stays catalog-agnostic). Repeating a cuisine across nights reads
   * as the engine not noticing, so it's penalized independently of the
   * per-restaurant repeat check above. */
  recentCuisines?: string[];
  /** Districts of recent nights' restaurants, most recent first — same
   * resolve-by-caller shape as recentCuisines. */
  recentMicroDistricts?: (MicroDistrict | null)[];
}

/** Same weight profileAffinity uses for an excluded tag (taste.ts's
 * AFFINITY_WEIGHTS.excluded) — one number, so a guest never sees a restaurant
 * they ruled out rank differently on /plan than it would on /answer. */
const EXCLUSION_PENALTY = -5;

function exclusionPenalty(haystack: string, exclusions: string[] | undefined): { score: number; reasons: string[] } {
  if (!exclusions?.length || !haystack) return { score: 0, reasons: [] };
  const normalized = normalize(haystack);
  const reasons: string[] = [];
  let score = 0;
  for (const excluded of exclusions) {
    if (!tagMatches(excluded, normalized)) continue;
    score += EXCLUSION_PENALTY;
    reasons.push(`You ruled out ${excluded}`);
  }
  return { score, reasons };
}

export function rankRestaurants(candidates: Restaurant[], ctx: RestaurantContext): ScoredPick<Restaurant>[] {
  const arcPosition = ctx.arcPosition ?? 'middle';
  return candidates
    .map((restaurant) => {
      const reasons: string[] = [];
      let score = budgetFitScore(restaurant.price, ctx.budget);

      // Climax night ("tonight's the splurge, you leave tomorrow") treats one
      // tier over budget as the intended pick, not a mismatch — the same
      // diff===1 case budgetFitScore above already scores as a small +0.5.
      if (arcPosition === 'climax' && ctx.budget) {
        const priceIndex = BUDGET_ORDER.indexOf(restaurant.price as BudgetPreference);
        const budgetIndex = BUDGET_ORDER.indexOf(ctx.budget);
        if (priceIndex - budgetIndex === 1) score += 1;
      }

      const haystack = restaurantHaystack(restaurant);
      const affinity = affinityScore(ctx.tasteTags, haystack);
      if (affinity > 0) {
        score += affinity;
        reasons.push('Matches your taste');
      }

      const excluded = exclusionPenalty(haystack, ctx.exclusions);
      score += excluded.score;
      reasons.push(...excluded.reasons);

      // Occasion-aware scoring — every check reads a real, already-verified
      // fact (reserveUrl, detailFacts operational text) rather than a
      // fabricated "romantic"/"group-friendly" catalog label.
      if (ctx.occasion) {
        const normalizedHaystack = normalize(haystack);
        if (ctx.occasion === 'date_night' && restaurant.reserveUrl) {
          score += 0.75;
          reasons.push('Reservable — good for date night');
        }
        if (ctx.occasion === 'group' && tagMatches('group dining', normalizedHaystack)) {
          score += 1.5;
          reasons.push('Group dining available');
        }
        if (ctx.occasion === 'solo' && (tagMatches('walk ins only', normalizedHaystack) || tagMatches('walk in counter', normalizedHaystack))) {
          score += 1;
          reasons.push('Walk-in friendly');
        }
      }

      const point = ctx.coordsOf(restaurant);
      if (ctx.anchor && point) {
        const minutes = walkMinutes(milesBetween(ctx.anchor, point));
        const walkBonus = Math.max(0, 3 - minutes / 6);
        // Arrival: still finding your feet, keep it close. Departure: early
        // flight tomorrow, don't wander. Both lean harder on proximity than a
        // normal middle-of-stay night.
        score += (arcPosition === 'arrival' || arcPosition === 'departure') ? walkBonus * 1.5 : walkBonus;
        reasons.push(`${minutes} min walk from you`);
      }

      const restaurantDistrict = microDistrictOf(restaurant.address);
      if (ctx.anchorMicroDistrict && restaurantDistrict === ctx.anchorMicroDistrict) {
        score += 1.5;
        reasons.push('Same neighborhood as your event');
      }
      if (ctx.recentMicroDistricts?.[0] && restaurantDistrict === ctx.recentMicroDistricts[0]) {
        score -= 1;
        reasons.push('Same neighborhood as last night');
      }

      const state = openStateFor(ctx.hoursOf(restaurant), ctx.dinnerAt);
      if (state.status === 'open') {
        score += 1;
        reasons.push(state.closesAt ? `Open till ${state.closesAt}` : 'Open 24 hours');
      } else if (state.status === 'closed') {
        score -= 6;
        reasons.push(state.opensAt ? `Closed then · opens ${state.opensAt}` : 'Closed at that time');
      }

      if (ctx.vibes.includes('Foodie') && restaurant.reserveUrl) {
        score += 1;
        reasons.push('Reservable');
      }

      const repeatRank = ctx.recentRestaurantIds.indexOf(restaurant.id);
      if (repeatRank === 0) {
        score -= 3;
        reasons.push('Had this the night before');
      } else if (repeatRank > 0) {
        score -= 1;
      }

      // Cuisine fatigue — a different restaurant can still repeat the same
      // cuisine two nights running with no signal from the id-based repeat
      // check above; this is the one that actually notices.
      if (ctx.recentCuisines?.[0] === restaurant.cuisine) {
        score -= 2;
        reasons.push('Same cuisine as last night');
      } else if (ctx.recentCuisines?.[1] === restaurant.cuisine) {
        score -= 1;
      }

      // Rating signal — high-rated spots surface naturally. Doubled on the
      // climax night: this is the one worth splurging on a sure thing.
      if (typeof restaurant.rating === 'number') {
        const climaxMultiplier = arcPosition === 'climax' ? 2 : 1;
        if (restaurant.rating >= 4.5) { score += 1.5 * climaxMultiplier; reasons.push(`Highly rated (${restaurant.rating}★)`); }
        else if (restaurant.rating >= 4.0) { score += 0.75 * climaxMultiplier; reasons.push(`Well rated (${restaurant.rating}★)`); }
      }

      // Late-night awareness — when dinner is after 9 PM, boost openLate
      if (ctx.dinnerAt.getHours() >= 21 && restaurant.openLate) {
        score += 1.5;
        reasons.push('Open late for tonight\'s plan');
      }

      // Saved venue boost
      if (ctx.savedPlaceKeys.includes(`restaurant:${restaurant.id}`)) {
        score += 2.0;
        reasons.push('On your saved list');
      }

      // Menu depth signal
      if (restaurant.menuHighlights && restaurant.menuHighlights.length >= 5) {
        score += Math.min(1.0, restaurant.menuHighlights.length / 10);
      }

      return { item: restaurant, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** How hard a landmark moves. Same magnitude as the Outdoors vibe bump, so a
 * trip context nudges the order without overruling taste. */
const LANDMARK_WEIGHT = 2;

export interface EventContext {
  tasteTags: string[];
  vibes: string[];
  weather: WeatherHour | null;
  /** What brings the guest to Oakland. The arrival sequence prints a concrete
   * promise per option — "Landmark venues move up" for visiting, "move down"
   * for live — and TRIP_CONTEXT_EFFECTS says the ranker has to honour it. This
   * is where it does. Null leaves the ordering alone. */
  tripContext?: TripContext | null;
  budget?: BudgetPreference | null;
  /** Same rule as RestaurantContext.exclusions — ranked down, never dropped. */
  exclusions?: string[];
  /** Same occasion signal as RestaurantContext — reads real vibeTags/cats text. */
  occasion?: Occasion | null;
}

export function rankEvents(candidates: ScoperEvent[], ctx: EventContext): ScoredPick<ScoperEvent>[] {
  return candidates
    .map((event) => {
      const reasons: string[] = [];
      let score = 0;

      const affinity = affinityScore(ctx.tasteTags, eventHaystack(event));
      if (affinity > 0) {
        score += affinity;
        reasons.push('Matches your taste');
      }

      const excluded = exclusionPenalty(eventHaystack(event), ctx.exclusions);
      score += excluded.score;
      reasons.push(...excluded.reasons);

      // Only where the catalog states a venue id — an event with no venueId is
      // left alone rather than matched on a display name that may not agree.
      if (ctx.tripContext && event.venueId && LANDMARK_VENUE_IDS.includes(event.venueId)) {
        if (ctx.tripContext === 'visiting') {
          score += LANDMARK_WEIGHT;
          reasons.push('Oakland landmark');
        } else if (ctx.tripContext === 'live') {
          score -= LANDMARK_WEIGHT;
          reasons.push('Landmark — making room for newer places');
        }
      }

      const isOutdoor = event.cats.includes('Outdoor');
      if (isOutdoor && ctx.weather?.precipProbability != null) {
        const precip = ctx.weather.precipProbability;
        if (precip >= 70) { score -= 5; reasons.push(`${precip}% rain — not ideal for outdoor`); }
        else if (precip >= 40) { score -= 3; reasons.push(`${precip}% rain forecast`); }
        else if (precip >= 20) { score -= 1; reasons.push(`${precip}% chance of rain`); }
      }
      if (ctx.vibes.includes('Outdoors') && isOutdoor && (ctx.weather?.precipProbability ?? 0) < 20) {
        score += 2;
        reasons.push('Outdoors');
      }
      if (isOutdoor && ctx.weather?.temperatureF != null) {
        if (ctx.weather.temperatureF < 50) { score -= 0.5; reasons.push('Cold evening forecast'); }
        else if (ctx.weather.temperatureF > 90) { score -= 0.5; reasons.push('Hot evening forecast'); }
      }
      if (ctx.vibes.includes('Nightlife') && event.cats.includes('Live music')) {
        score += 2;
        reasons.push('Live music');
      }

      if (ctx.occasion === 'date_night' && tagMatches('reserved seating', normalize(eventHaystack(event)))) {
        score += 1;
        reasons.push('Reserved seating');
      }

      // Budget-aware event selection. A label like "$25–$60" is a range, not a
      // single number — matching only the first figure read a $60 show as $25.
      // The floor (cheapest ticket) decides "budget-friendly"; the ceiling
      // (priciest ticket) decides "premium" — each check uses the number that
      // actually answers its own question.
      if (ctx.budget) {
        const priceMatches = [...(event.priceLabel?.matchAll(/\$(\d+(?:\.\d+)?)/g) ?? [])].map((m) => Number(m[1]));
        const priceFloor = priceMatches.length ? Math.min(...priceMatches) : null;
        const priceCeiling = priceMatches.length ? Math.max(...priceMatches) : null;
        if (priceFloor !== null && priceCeiling !== null) {
          if (ctx.budget === '$' && priceFloor <= 30) { score += 1; reasons.push('Budget-friendly'); }
          else if (ctx.budget === '$$$' && priceCeiling >= 60) { score += 1; reasons.push('Premium experience'); }
        }
      }

      return { item: event, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export interface NightlifeContext {
  tasteTags: string[];
  anchor: GeoPoint | null;
  coordsOf: (spot: NightlifeSpot) => GeoPoint | null;
  /** Same signal as RestaurantContext.anchorMicroDistrict. */
  anchorMicroDistrict?: MicroDistrict | null;
}

export function rankNightlife(candidates: NightlifeSpot[], ctx: NightlifeContext): ScoredPick<NightlifeSpot>[] {
  return candidates
    .map((spot) => {
      const reasons: string[] = [];
      let score = affinityScore(ctx.tasteTags, spot.kind);
      if (score > 0) reasons.push('Matches your taste');

      const point = ctx.coordsOf(spot);
      if (ctx.anchor && point) {
        const minutes = walkMinutes(milesBetween(ctx.anchor, point));
        score += Math.max(0, 2 - minutes / 8);
        reasons.push(`${minutes} min walk`);
      }

      if (ctx.anchorMicroDistrict && microDistrictOf(spot.address) === ctx.anchorMicroDistrict) {
        score += 1.5;
        reasons.push('Same neighborhood as your night');
      }

      return { item: spot, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** Picks the best-ranked candidate that keeps the walk from `fromPoint` within
 * budget, skipping `avoidId` (the currently-shown pick, for Regenerate) when a
 * real alternative exists. Falls back to the top-ranked candidate rather than
 * returning nothing — a joint constraint that can't be satisfied should still
 * produce a night, just without the "kept close" guarantee (CLAUDE.md #6). */
function pickFeasible<T extends { id: string }>(
  ranked: ScoredPick<T>[],
  opts: {
    lockedId?: string | null;
    avoidId?: string | string[] | null;
    fromPoint: GeoPoint | null;
    coordsOf: (item: T) => GeoPoint | null;
    walkBudgetMin: number;
    variety?: boolean;
    /** Source of randomness for the variety draw below. Defaults to
     * Math.random — true randomness — so every existing caller (manual
     * Regenerate/"Another set" taps) keeps feeling different on every tap.
     * The concierge adapter is the one caller that passes a seeded generator,
     * so the same sentence asked at the same moment reproduces the same plan. */
    random?: () => number;
  },
): { item: T; score: number; reasons: string[] } | null {
  if (!ranked.length) return null;
  if (opts.lockedId) {
    const locked = ranked.find((pick) => pick.item.id === opts.lockedId);
    if (locked) return locked;
  }

  const random = opts.random ?? Math.random;
  const avoidIds = opts.avoidId ? (Array.isArray(opts.avoidId) ? opts.avoidId : [opts.avoidId]) : [];
  const pool = avoidIds.length && ranked.length > 1 ? ranked.filter((pick) => !avoidIds.includes(pick.item.id)) : ranked;

  if (opts.fromPoint) {
    const withinBudget = pool.filter((pick) => {
      const point = opts.coordsOf(pick.item);
      return point ? walkMinutes(milesBetween(opts.fromPoint!, point)) <= opts.walkBudgetMin : false;
    });
    if (withinBudget.length > 0) {
      if (opts.variety && withinBudget.length > 1) {
        const maxScore = withinBudget[0].score;
        const topTiers = withinBudget.filter((p) => maxScore - p.score <= 1.0);
        const randomIndex = Math.floor(random() * topTiers.length);
        return topTiers[randomIndex];
      }
      return withinBudget[0];
    }
  }

  if (opts.variety && pool.length > 1) {
    const maxScore = pool[0]?.score ?? 0;
    const topTiers = pool.filter((p) => maxScore - p.score <= 1.0);
    const randomIndex = Math.floor(random() * topTiers.length);
    return topTiers[randomIndex] ?? pool[0] ?? ranked[0];
  }

  return pool[0] ?? ranked[0];
}

export function walkLegLabel(from: GeoPoint | null, to: GeoPoint | null): string | null {
  if (!from || !to) return null;
  return `${walkMinutes(milesBetween(from, to))} min walk`;
}

export interface SolveInputs {
  restaurants: ScoredPick<Restaurant>[];
  events: ScoredPick<ScoperEvent>[];
  /** null when the night's pace has no nightcap slot (CLAUDE.md: never invent
   * a stop the guest didn't ask for). */
  nightlife: ScoredPick<NightlifeSpot>[] | null;
  coordsOfRestaurant: (restaurant: Restaurant) => GeoPoint | null;
  coordsOfEvent: (event: ScoperEvent) => GeoPoint | null;
  coordsOfNightlife: (spot: NightlifeSpot) => GeoPoint | null;
  pace: PacePreference;
  locked: { restaurantId?: string | null; eventId?: string | null; nightlifeId?: string | null };
  /** Currently-shown picks to steer away from on Regenerate; omit on first generate.
   * Each field accepts multiple ids so callers can avoid several prior picks at once
   * (e.g. "Another set" steering away from both the primary and secondary card). */
  avoid?: { restaurantId?: string | string[] | null; eventId?: string | string[] | null; nightlifeId?: string | string[] | null };
  variety?: boolean;
  /** Numeric seed for the variety draw — same seed, same pools, same pick.
   * Omit for true randomness (every existing Regenerate/"Another set" caller).
   * The concierge adapter derives one from the guest's sentence + the planned
   * moment, so asking the same thing twice reproduces the same plan. */
  seed?: number;
}

export interface SolvedNight {
  restaurant: Restaurant | null;
  event: ScoperEvent | null;
  nightlifeSpot: NightlifeSpot | null;
  reasons: { restaurant: string[]; event: string[]; nightlife: string[] };
}

/** Joint pick across the three slots: the event anchors the night (its time
 * drives dinner's slot upstream in computeDinnerTime), the restaurant is
 * chosen to stay walkable from it, and the nightcap to stay walkable from
 * dinner — each step falling back to the best-ranked option rather than
 * leaving a slot empty when no walkable option exists. */
export function solveNight(inputs: SolveInputs): SolvedNight {
  const walkBudgetMin = PACE_WALK_BUDGET_MIN[inputs.pace];
  // One shared generator across all three slots when seeded, so "event, then
  // restaurant, then nightlife" draws from a single reproducible sequence
  // rather than each slot restarting from the same seed and correlating.
  const random = inputs.seed != null ? mulberry32(inputs.seed) : undefined;

  const eventPick = pickFeasible(inputs.events, {
    lockedId: inputs.locked.eventId,
    avoidId: inputs.avoid?.eventId,
    fromPoint: null,
    coordsOf: inputs.coordsOfEvent,
    walkBudgetMin,
    variety: inputs.variety,
    random,
  });
  const eventPoint = eventPick ? inputs.coordsOfEvent(eventPick.item) : null;

  const restaurantPick = pickFeasible(inputs.restaurants, {
    lockedId: inputs.locked.restaurantId,
    avoidId: inputs.avoid?.restaurantId,
    fromPoint: eventPoint,
    coordsOf: inputs.coordsOfRestaurant,
    walkBudgetMin,
    variety: inputs.variety,
    random,
  });
  const restaurantPoint = restaurantPick ? inputs.coordsOfRestaurant(restaurantPick.item) : null;

  const nightlifePick = inputs.nightlife
    ? pickFeasible(inputs.nightlife, {
        lockedId: inputs.locked.nightlifeId,
        avoidId: inputs.avoid?.nightlifeId,
        fromPoint: restaurantPoint,
        coordsOf: inputs.coordsOfNightlife,
        walkBudgetMin,
        variety: inputs.variety,
        random,
      })
    : null;

  return {
    restaurant: restaurantPick?.item ?? null,
    event: eventPick?.item ?? null,
    nightlifeSpot: nightlifePick?.item ?? null,
    reasons: {
      restaurant: restaurantPick?.reasons ?? [],
      event: eventPick?.reasons ?? [],
      nightlife: nightlifePick?.reasons ?? [],
    },
  };
}

// ── Time model ───────────────────────────────────────────────────────────
// A picked event isn't just another stop — its curtain time governs when
// dinner actually happens. A 5 PM show wants dinner after, not a 3 PM one
// squeezed in before. The catalog's real startsAt timestamp (Oakland local,
// carries its own UTC offset) is the only clock read here.

/** Typical dinner-before-showtime gap when the restaurant isn't known yet
 * (the ranking pass computes dinnerAt before a restaurant is picked, so it
 * has no price tier to read) — a median between a quick bite and a full
 * sit-down, matching how the curated dinner set is written (openLate,
 * reserveUrl spots assume roughly this window). */
const PRE_SHOW_DINNER_BUFFER_MIN = 105;

/** Once a restaurant is actually picked, its price tier is a real, verified
 * proxy for how long dinner takes — a $$$ tasting-menu-adjacent spot needs
 * more runway before a show than a $ counter-service one. Used by
 * planStopOrder (which already knows the solved restaurant) to place dinner
 * more realistically than the fixed pre-restaurant estimate above. */
function dinnerDurationMinutes(restaurant: Restaurant | null): number {
  if (!restaurant) return PRE_SHOW_DINNER_BUFFER_MIN;
  if (restaurant.price === '$$$') return 120;
  if (restaurant.price === '$$') return 90;
  if (restaurant.price === '$') return 60;
  return PRE_SHOW_DINNER_BUFFER_MIN;
}

/** Earliest hour dinner is still dinner — a show before this leaves no sane
 * pre-show dinner window, so dinner moves after it instead (matinee/brunch shows). */
const EARLIEST_SENSIBLE_DINNER_HOUR = 11;

function eventStartLocal(event: ScoperEvent | null): Date | null {
  if (!event?.startsAt) return null;
  const parsed = new Date(event.startsAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** When dinner actually happens tonight — anchored to the picked event's real
 * start time when one exists, a plain 7 PM default when it doesn't. Feeds
 * straight into rankRestaurants' open-now check, so "closed by dinner" is
 * evaluated at the true planned hour, not whatever moment Generate was tapped.
 * `restaurant` is optional and only available once one has been picked
 * (planStopOrder passes it; the upstream ranking-pass call site can't, since
 * dinnerAt has to exist before restaurants are even ranked) — omitting it
 * keeps the same fixed-buffer estimate this always used. */
export function computeDinnerTime(
  event: ScoperEvent | null,
  selectedDateAt: Date,
  restaurant: Restaurant | null = null,
  /** Minutes past midnight to fall back to when there is no show to sit before
   * — the arrival sequence's trip-context promise ("dinner defaults earlier"),
   * passed in rather than read here so this stays a pure function of its
   * inputs. Null keeps the neutral 7 PM. */
  defaultDinnerAtMinutes: number | null = null,
): Date {
  const showStart = eventStartLocal(event);
  if (!showStart) {
    const fallback = new Date(selectedDateAt);
    const minutes = defaultDinnerAtMinutes ?? 19 * 60;
    fallback.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return fallback;
  }
  const preShow = new Date(showStart.getTime() - dinnerDurationMinutes(restaurant) * 60 * 1000);
  if (preShow.getHours() >= EARLIEST_SENSIBLE_DINNER_HOUR) return preShow;
  return new Date(showStart.getTime() + 30 * 60 * 1000);
}

export type StopKind = 'event' | 'dinner' | 'nightlife';

/** Clock-real stop order for the timeline — dinner lands before or after the
 * event depending on the show's actual start time, instead of always coming
 * second. Nightlife (no fixed start time in the catalog) always closes the
 * night out, which is the one ordering fact this doesn't compute — it names it. */
export function planStopOrder(
  event: ScoperEvent | null,
  restaurant: Restaurant | null,
  nightlifeSpot: NightlifeSpot | null,
  selectedDateAt: Date,
  /** Forwarded to computeDinnerTime — see there. */
  defaultDinnerAtMinutes: number | null = null,
): { order: StopKind[]; dinnerAt: Date; dinnerTimeLabel: string } {
  const dinnerAt = computeDinnerTime(event, selectedDateAt, restaurant, defaultDinnerAtMinutes);
  const dinnerTimeLabel = clockLabel(dinnerAt.getHours() * 60 + dinnerAt.getMinutes());
  const showStart = eventStartLocal(event);

  const core: StopKind[] = [];
  if (event && restaurant) {
    core.push(...(showStart && dinnerAt.getTime() > showStart.getTime() ? (['event', 'dinner'] as StopKind[]) : (['dinner', 'event'] as StopKind[])));
  } else if (event) {
    core.push('event');
  } else if (restaurant) {
    core.push('dinner');
  }

  return { order: nightlifeSpot ? [...core, 'nightlife'] : core, dinnerAt, dinnerTimeLabel };
}

/** Walk legs between consecutive stops in `order` — one entry per gap, so
 * `legs[i]` is the leg after `order[i]`. Null where either endpoint's
 * coordinates aren't known, same "never estimate" rule as geo.ts. */
export function orderedLegs(order: StopKind[], pointOf: (kind: StopKind) => GeoPoint | null): (string | null)[] {
  const legs: (string | null)[] = [];
  for (let i = 0; i < order.length - 1; i += 1) {
    legs.push(walkLegLabel(pointOf(order[i]), pointOf(order[i + 1])));
  }
  return legs;
}

// ── Home section competition ────────────────────────────────────────────────
//
// Sections compete for the slots below the fold instead of rendering in a fixed
// order. Each declares whether it's eligible at all, what it scores, and why it
// is on screen — so "only things related to this guest, right now" is enforced
// structurally rather than by editorial discipline.
//
// Deliberately absent: an "Outside right now" section. It needs an outdoor
// catalog to point at, and there isn't one yet — a section that competes and
// wins with nothing behind it is worse than one that doesn't exist.

export type HomeSectionId = 'stay' | 'kitchens' | 'events' | 'collections';

export interface HomeSectionCandidate {
  id: HomeSectionId;
  score: number;
  /** Printed under the section heading. Computed, never generated. */
  reason: string | null;
}

export function rankHomeSections(ctx: {
  hasActiveStay: boolean;
  eventsCountToday: number;
  matchedTasteTags: string[];
  hasCollections: boolean;
}): HomeSectionCandidate[] {
  const tasteReason = ctx.matchedTasteTags.length
    ? `Because you asked for ${ctx.matchedTasteTags.slice(0, 2).join(' and ')}`
    : null;

  const candidates: (HomeSectionCandidate & { eligible: boolean })[] = [
    {
      id: 'stay',
      eligible: ctx.hasActiveStay,
      score: 10,
      reason: 'Your stay is on',
    },
    {
      id: 'events',
      eligible: ctx.eventsCountToday > 0,
      score: ctx.eventsCountToday > 2 ? 8.5 : 6,
      reason: `${ctx.eventsCountToday} on tonight`,
    },
    {
      id: 'kitchens',
      eligible: true,
      score: ctx.matchedTasteTags.length ? 8 : 7,
      reason: tasteReason,
    },
    {
      id: 'collections',
      eligible: ctx.hasCollections,
      score: 4,
      reason: null,
    },
  ];

  return candidates
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => b.score - a.score)
    .map(({ eligible: _eligible, ...candidate }) => candidate);
}
