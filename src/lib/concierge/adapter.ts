// Turns a validated ConciergeRequest into the same real plan create.tsx
// already produces — mirrors src/app/(tabs)/create.tsx:241-374 call for call.
// Nothing about plan-engine.ts's ranking logic is reimplemented here; this is
// only field mapping plus the one thing the engine doesn't do — narrowing the
// event pool to the guest's stated time window.
import { currentEventListings, isEventToday, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES, type NightlifeSpot, type Restaurant, type ScoperEvent } from '@/lib/data';
import type { GeoPoint } from '@/lib/geo';
import { computeDinnerTime, microDistrictOf, orderedLegs, planStopOrder, rankEvents, rankNightlife, rankRestaurants, solveNight, type StopKind } from '@/lib/plan-engine';
import { hashString } from '@/lib/rng';
import { stayArcPosition, todayIso } from '@/lib/stay';
import { normalize, restaurantHaystack, tagMatches } from '@/lib/taste';
import type { WayveeStay } from '@/lib/user-data';
import type { WeatherHour } from '@/lib/weather';
import type { ConciergeDomain, ConciergePlan, ConciergeRequest, RelaxedConstraint } from './types';

/** The only three vibe literals plan-engine.ts checks for
 * (rankRestaurants at plan-engine.ts:91, rankEvents at :131,:135). A mood tag
 * that happens to match one of these also acts as a vibe; anything else only
 * ever feeds taste affinity. */
const KNOWN_VIBES = ['Foodie', 'Outdoors', 'Nightlife'] as const;

export interface ConciergeContext {
  anchor: GeoPoint | null;
  tasteTags: string[];
  coordsOf: (entry: { name: string; address?: string | null }) => GeoPoint | null;
  hoursOf: (entry: { name: string; address?: string | null }) => string | null;
  weather: WeatherHour | null;
  /** The planned night, noon-anchored — same role as create.tsx's selectedDateAt. */
  now: Date;
  recentRestaurantIds: string[];
  /** Optional specific event, restaurant, or nightlife spot to lock into the
   * plan (from deep links/CTAs). Nightlife has no independent "explore" pool
   * scoping the way events/restaurants do (rankNightlife always runs over the
   * full catalog) — targeting one just forces it into the nightcap slot and
   * turns the slot on, same as wantsNightlife would. */
  targetEventId?: string | null;
  targetRestaurantId?: string | null;
  targetNightlifeId?: string | null;
  /** A venue or crawl the guest tapped "Plan a night around" from — it isn't
   * itself a night stop (CLAUDE.md #4: never invent a slot for a container),
   * but it should anchor walkability and, for a venue, narrow the event slot
   * to that venue's own current listings. */
  venueId?: string | null;
  /** Overrides ctx.anchor for walkability scoring when the guest's ask is
   * explicitly anchored to a place other than their device location (a
   * venue's or crawl's own coordinates) — CLAUDE.md #1: anchored to a place,
   * and the place they tapped from is a stronger signal than "here". */
  anchorPoint?: GeoPoint | null;
  /** Picks to steer away from — set by callers handling a 'refine' ask to the
   * previous plan's own restaurant/event, so "make that cheaper" visibly moves
   * even when nothing else about the ranking changed (same pattern as
   * create.tsx's "Another set", plan-engine.ts's SolveInputs.avoid). */
  avoidRestaurantId?: string | string[] | null;
  avoidEventId?: string | string[] | null;
  allowVariety?: boolean;
  /** Candidate pools, real catalog by default. Overridable so tests can run
   * buildPlan against literal fixtures instead of RESTAURANTS/EVENTS/NIGHTLIFE_SPOTS. */
  restaurantPool?: Restaurant[];
  eventPool?: ScoperEvent[];
  nightlifePool?: NightlifeSpot[];
  savedPlaceKeys?: string[];
  /** The guest's linked stay, when there is one — used only to place tonight
   * on its arc (arrival/middle/climax/departure). No stay means every night
   * scores as 'middle', today's flat behavior. */
  stay?: WayveeStay | null;
}

function timeOnDate(base: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const at = new Date(base);
  at.setHours(hours, minutes, 0, 0);
  return at;
}

/** An evening's own "back by" is almost always after midnight, not before it:
 * "back by midnight"/"back by 1am" means the small hours of the *next*
 * calendar day, not 00:00-04:59 on the evening's own date — which would fall
 * hours before the first event even starts. Same 5 AM cutoff daypart.ts uses
 * for "still last night" (daypart.ts:16), applied in the opposite direction. */
function timeOnEveningDate(base: Date, hhmm: string): Date {
  const at = timeOnDate(base, hhmm);
  const hour = Number(hhmm.slice(0, 2));
  if (hour < 5) at.setDate(at.getDate() + 1);
  return at;
}

/** Turns the actual device clock into the noon-anchored `now` this module's
 * ctx.now contract expects — the same anchoring create.tsx's selectedDateAt
 * already applies to a chosen calendar date (create.tsx:132-136), just derived
 * from "right now" instead of a date picker. Before 5 AM (daypart.ts's own
 * 'lateNight' cutoff), the guest is still living in last night's plan, so
 * "tonight" means yesterday's evening — otherwise "back by midnight" and
 * similar phrases silently fail: midnight-as-00:00 on *today* is already
 * hours before every evening event, so applyTimeWindow finds nothing to
 * narrow to and quietly relaxes the whole constraint instead. */
export function resolveAskNow(rawNow: Date): Date {
  const at = new Date(rawNow);
  if (at.getHours() < 5) at.setDate(at.getDate() - 1);
  at.setHours(12, 0, 0, 0);
  return at;
}

/** Narrows the event pool to the guest's stated window without ever
 * hard-failing: an empty result after filtering falls back to the
 * unfiltered pool and says so (CLAUDE.md #6), rather than returning nothing. */
function applyTimeWindow(
  pool: ScoperEvent[],
  timeWindow: ConciergeRequest['timeWindow'],
  now: Date,
): { pool: ScoperEvent[]; relaxed: boolean } {
  if (!timeWindow.startsBy && !timeWindow.backBy) return { pool, relaxed: false };

  const startsByAt = timeWindow.startsBy ? timeOnEveningDate(now, timeWindow.startsBy) : null;
  const backByAt = timeWindow.backBy ? timeOnEveningDate(now, timeWindow.backBy) : null;

  const narrowed = pool.filter((event) => {
    if (!event.startsAt) return true;
    const start = new Date(event.startsAt);
    if (Number.isNaN(start.getTime())) return true;
    if (startsByAt && start < startsByAt) return false;
    if (backByAt && start > backByAt) return false;
    return true;
  });

  if (narrowed.length > 0) return { pool: narrowed, relaxed: false };
  return { pool, relaxed: true };
}

/** Drops a restaurant entirely when a real, already-verified field (cuisine,
 * searchTags, menu item names) matches a stated allergy/dietary restriction —
 * the one deliberate exception to CLAUDE.md's "never drop, only demote" rule,
 * because a downranked allergen is still a plan that can hurt someone.
 * Falls back to the unfiltered pool (flagged, never silent) rather than ever
 * handing back an empty restaurant slot over a dietary constraint — the same
 * narrow-but-never-to-zero shape as applyTimeWindow above. */
function applyHardExclusions(pool: Restaurant[], hardExclusions: string[]): { pool: Restaurant[]; relaxed: boolean } {
  if (!hardExclusions.length) return { pool, relaxed: false };
  const safe = pool.filter((restaurant) => {
    const haystack = normalize(restaurantHaystack(restaurant));
    return !hardExclusions.some((term) => tagMatches(term, haystack));
  });
  if (safe.length > 0) return { pool: safe, relaxed: false };
  return { pool, relaxed: true };
}

/** Catalog areas request.domains can name that map to the event slot — 'food'
 * is the only domain that maps to the restaurant slot instead. */
const EVENT_DOMAINS: readonly ConciergeDomain[] = ['events', 'music', 'film'];

/** A non-empty domains list scopes which slots are even in play — "just
 * dinner, no show" (domains: ['food']) should never end up with an event
 * anyway. An empty list means the guest didn't scope anything, so every slot
 * stays eligible, same as before this field existed. */
function scopeToDomains<T>(pool: T[], domains: ConciergeDomain[], allowed: readonly ConciergeDomain[]): T[] {
  if (!domains.length) return pool;
  return domains.some((domain) => allowed.includes(domain)) ? pool : [];
}

export function buildPlan(request: ConciergeRequest, ctx: ConciergeContext): ConciergePlan {
  const pace = request.pace ?? 'Relaxed';
  const vibes = request.moodTags.filter((tag): tag is (typeof KNOWN_VIBES)[number] => (KNOWN_VIBES as readonly string[]).includes(tag));
  const tasteTags = [...new Set([...ctx.tasteTags, ...request.moodTags])];
  // Seeds the variety draw in solveNight: same sentence, same planned moment,
  // same plan — while every manual Regenerate tap elsewhere stays truly random
  // (plan-engine.ts's pickFeasible defaults to Math.random when unseeded).
  const seed = hashString(`${request.rawText}|${ctx.now.toISOString()}`);

  // A CTA-anchored place (venue/crawl) is a stronger walkability signal than
  // wherever the device happens to be — falls back to the device fix when
  // there's no explicit anchor, same as create.tsx's own anchor.
  const anchor = ctx.anchorPoint ?? ctx.anchor;

  const rawEvents = ctx.eventPool ?? currentEventListings(ctx.now);
  const allAvailableEvents = scopeToDomains(rawEvents, request.domains, EVENT_DOMAINS);
  let onThisDate = (ctx.eventPool ? allAvailableEvents : allAvailableEvents.filter((event) => isEventToday(event, ctx.now))).slice();

  // A venue CTA narrows the event slot to that venue's own current listings —
  // but only when it actually has any; an empty result silently falls back to
  // the full pool rather than leaving the event slot empty (CLAUDE.md #6).
  if (ctx.venueId) {
    const atVenue = onThisDate.filter((event) => event.venueId === ctx.venueId);
    if (atVenue.length) onThisDate = atVenue;
  }

  // A deep-linked/CTA target event (ctx.targetEventId) is an explicit ask the
  // guest already made by tapping — it resolves against the raw, unscoped
  // pool so a domains guess that happens to exclude 'events' can never make a
  // target the guest already chose unfindable.
  let targetEvent: ScoperEvent | null = null;
  if (ctx.targetEventId) {
    targetEvent = rawEvents.find((e) => e.id === ctx.targetEventId) ?? null;
  }
  
  let vibePool = onThisDate;
  if (targetEvent && !vibePool.some((e) => e.id === targetEvent.id)) {
    vibePool = [targetEvent, ...vibePool];
  }
  // Each vibe narrows further from the *previous* step's pool, not the
  // original one — asking for Outdoors AND Nightlife should intersect both,
  // not have the second filter silently replace the first. Same
  // narrow-but-never-to-zero fallback as before: an empty intersection keeps
  // the pool from the prior step instead of discarding it.
  if (vibes.includes('Outdoors')) {
    const outdoor = vibePool.filter((event) => (event.cats as string[]).includes('Outdoor'));
    if (outdoor.length) vibePool = outdoor;
  }
  if (vibes.includes('Nightlife')) {
    const nightlife = vibePool.filter((event) => (event.cats as string[]).includes('Live music'));
    if (nightlife.length) vibePool = nightlife;
  }
  const { pool: eventPool, relaxed: backByRelaxed } = applyTimeWindow(vibePool, request.timeWindow, ctx.now);

  // Guarantee target event is in eventPool
  const finalEventPool = targetEvent && !eventPool.some((e) => e.id === targetEvent.id) ? [targetEvent, ...eventPool] : eventPool;

  const rankedEvents = rankEvents(finalEventPool, {
    tasteTags,
    vibes,
    weather: ctx.weather,
    budget: request.budget,
    exclusions: request.exclusions,
    occasion: request.occasion,
  });
  const topEvent = (targetEvent ? rankedEvents.find((e) => e.item.id === targetEvent.id) : null)?.item ?? rankedEvents[0]?.item ?? null;
  const dinnerAt = computeDinnerTime(topEvent, ctx.now);
  // The anchor event/venue's district clusters the rest of the night around
  // it — falls back to a venue CTA's own address when there's no picked
  // event (e.g. domains: ['food'] narrowed the night to dinner only).
  const anchorMicroDistrict = microDistrictOf(topEvent?.addr ?? (ctx.venueId ? VENUES[ctx.venueId]?.address : null));
  const arcPosition = ctx.stay ? stayArcPosition(ctx.stay, todayIso(ctx.now)) : 'middle';
  // Resolved by this caller (not plan-engine.ts, which stays catalog-agnostic) —
  // same ids recentRestaurantIds already carries, just looked up for their
  // cuisine/district.
  const recentCuisines = ctx.recentRestaurantIds.map((id) => RESTAURANTS[id]?.cuisine).filter((c): c is string => Boolean(c));
  const recentMicroDistricts = ctx.recentRestaurantIds.map((id) => microDistrictOf(RESTAURANTS[id]?.address ?? null));

  // Same domains scoping as the event pool, and the same guarantee: an
  // explicit deep-linked target restaurant is never made unfindable by a
  // domains guess (mirrors targetEvent above).
  const rawRestaurants = ctx.restaurantPool ?? Object.values(RESTAURANTS);
  const scopedRestaurants = scopeToDomains(rawRestaurants, request.domains, ['food']);
  // Dietary safety runs before the target-restaurant guarantee below: a place
  // the guest explicitly tapped/deep-linked into is their own informed
  // choice, same precedent as domains never hiding a target (CLAUDE.md #1)  —
  // it's only the ranking-driven "pick something for me" pool that needs the
  // hard filter.
  const { pool: dietSafeRestaurants, relaxed: hardExclusionsRelaxed } = applyHardExclusions(scopedRestaurants, request.hardExclusions);
  const targetRestaurant = ctx.targetRestaurantId ? (rawRestaurants.find((r) => r.id === ctx.targetRestaurantId) ?? null) : null;
  const finalRestaurantPool =
    targetRestaurant && !dietSafeRestaurants.some((r) => r.id === targetRestaurant.id) ? [targetRestaurant, ...dietSafeRestaurants] : dietSafeRestaurants;

  const rankedRestaurants = rankRestaurants(finalRestaurantPool, {
    budget: request.budget,
    tasteTags,
    vibes,
    anchor,
    coordsOf: ctx.coordsOf,
    hoursOf: ctx.hoursOf,
    dinnerAt,
    recentRestaurantIds: ctx.recentRestaurantIds,
    savedPlaceKeys: ctx.savedPlaceKeys ?? [],
    exclusions: request.exclusions,
    occasion: request.occasion,
    anchorMicroDistrict,
    arcPosition,
    recentCuisines,
    recentMicroDistricts,
  });

  // A targeted nightlife spot (from a night-spot's own "Plan around this" CTA)
  // turns the nightcap slot on the same way an explicit ask or Packed pace
  // would — the guest already chose it by tapping, so the slot exists.
  const wantsNightlife = request.wantsNightlife || pace === 'Packed' || Boolean(ctx.targetNightlifeId);
  const rankedNightlife = wantsNightlife
    ? rankNightlife(ctx.nightlifePool ?? NIGHTLIFE_SPOTS, { tasteTags, anchor, coordsOf: ctx.coordsOf, anchorMicroDistrict })
    : null;

  const solved = solveNight({
    restaurants: rankedRestaurants,
    events: rankedEvents,
    nightlife: rankedNightlife,
    coordsOfRestaurant: ctx.coordsOf,
    coordsOfEvent: (event) => ctx.coordsOf({ name: event.venue }),
    coordsOfNightlife: ctx.coordsOf,
    pace,
    locked: {
      eventId: ctx.targetEventId ?? null,
      restaurantId: ctx.targetRestaurantId ?? null,
      nightlifeId: ctx.targetNightlifeId ?? null,
    },
    avoid: {
      restaurantId: ctx.avoidRestaurantId ?? null,
      eventId: ctx.avoidEventId ?? null,
    },
    variety: ctx.allowVariety ?? false,
    seed,
  });

  const { order: stopOrder, dinnerTimeLabel } = planStopOrder(solved.event, solved.restaurant, solved.nightlifeSpot, ctx.now);
  const pointForStop = (kind: StopKind): GeoPoint | null => {
    if (kind === 'event') return solved.event ? ctx.coordsOf({ name: solved.event.venue }) : null;
    if (kind === 'dinner') return solved.restaurant ? ctx.coordsOf(solved.restaurant) : null;
    return solved.nightlifeSpot ? ctx.coordsOf(solved.nightlifeSpot) : null;
  };
  const stopLegs = orderedLegs(stopOrder, pointForStop);

  const relaxed: RelaxedConstraint[] = [];
  if (backByRelaxed) relaxed.push('backBy');
  if (hardExclusionsRelaxed) relaxed.push('hardExclusions');
  const notes = hardExclusionsRelaxed
    ? ['No restaurant tonight avoided every dietary restriction you gave — shown anyway rather than no plan at all.']
    : [];

  return {
    solved,
    stopOrder,
    stopLegs,
    dinnerTimeLabel,
    confidence: relaxed.length ? 'narrowed' : (solved.event === null && solved.restaurant === null) ? 'fallback' : 'strong',
    notes,
    relaxed,
  };
}

// ── Refine ───────────────────────────────────────────────────────────────
//
// A 'refine' ask ("make that cheaper", "something closer") is short by
// design — the guest is adjusting a plan already on screen, not restating it.
// The model still only returns the same enum-only ConciergeRequest shape (no
// separate "delta" schema), so most fields on a refine turn come back
// null/empty simply because nothing in "make that cheaper" mentions them —
// not because the guest wants them cleared. Merging onto the previous ask's
// own request is what keeps a forgotten pace/mood/exclusion from silently
// resetting on every refine.

/** New non-null/non-empty fields win; everything the guest didn't restate
 * carries over from the plan already on screen. Exclusions are additive —
 * refine has no lever to *un*-rule-out something, so previous ones always
 * stay. wantsNightlife has no null state (the schema requires a plain
 * boolean), so it can only turn on across a refine, never back off — the
 * guest can still drop a nightcap explicitly via the pace/budget pickers, the
 * same UI it already offers today. */
export function mergeRefineRequest(previous: ConciergeRequest, incoming: ConciergeRequest): ConciergeRequest {
  return {
    intent: 'plan_evening',
    rawText: incoming.rawText,
    domains: incoming.domains.length ? incoming.domains : previous.domains,
    exclusions: [...new Set([...previous.exclusions, ...incoming.exclusions])],
    // Same additive rule as exclusions — a refine turn has no lever to
    // un-declare an allergy, so a hardExclusion from an earlier turn always
    // stays in force even when the guest doesn't repeat it.
    hardExclusions: [...new Set([...previous.hardExclusions, ...incoming.hardExclusions])],
    occasion: incoming.occasion ?? previous.occasion,
    pace: incoming.pace ?? previous.pace,
    budget: incoming.budget ?? previous.budget,
    moodTags: incoming.moodTags.length ? incoming.moodTags : previous.moodTags,
    timeWindow: {
      startsBy: incoming.timeWindow.startsBy ?? previous.timeWindow.startsBy,
      backBy: incoming.timeWindow.backBy ?? previous.timeWindow.backBy,
    },
    wantsNightlife: incoming.wantsNightlife || previous.wantsNightlife,
    confidence: incoming.confidence,
  };
}
