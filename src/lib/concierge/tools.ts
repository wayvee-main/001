// The five tool wrappers from docs/build-book.md Part 3.5 — each a pure
// function around code that already exists (data.ts, weather.ts,
// plan-engine.ts), so a catalog lookup always happens against live data at
// call time, never a stale snapshot baked into a prompt. Named exactly per
// TODO.md so a real tool-calling loop can wrap these later without a rewrite.
import { currentEventListings, isEventToday, NIGHTLIFE_SPOTS, RESTAURANTS, type NightlifeSpot, type Restaurant, type ScoperEvent } from '@/lib/data';
import {
  rankEvents,
  rankNightlife,
  rankRestaurants,
  solveNight,
  type EventContext,
  type NightlifeContext,
  type RestaurantContext,
  type SolveInputs,
  type SolvedNight,
} from '@/lib/plan-engine';
import { weatherAt, type WeatherHour } from '@/lib/weather';

/** Retrieval only — mirrors create.tsx's unfiltered candidate pool exactly.
 * Budget/taste/distance/open-now are ranking terms, not hard filters, so
 * nothing here narrows the pool before rankRestaurants scores it. */
export function searchRestaurants(): Restaurant[] {
  return Object.values(RESTAURANTS);
}

/** Today's real, current listings — same call create.tsx makes for the
 * selected night. `now` should be the planned night, not necessarily this
 * instant. */
export function searchEventsTonight(now = new Date()): ScoperEvent[] {
  return currentEventListings(now).filter((event) => isEventToday(event, now));
}

export function searchNightlife(): NightlifeSpot[] {
  return NIGHTLIFE_SPOTS;
}

/** Non-hook read of the current forecast hour — null when nothing is
 * hydrated, never a guess. */
export function checkWeatherNow(now: Date, hours: WeatherHour[]): WeatherHour | null {
  return weatherAt(now, hours);
}

export interface RankAndSolveInputs {
  restaurants: { candidates: Restaurant[]; ctx: RestaurantContext };
  events: { candidates: ScoperEvent[]; ctx: EventContext };
  nightlife: { candidates: NightlifeSpot[]; ctx: NightlifeContext } | null;
  solve: Omit<SolveInputs, 'restaurants' | 'events' | 'nightlife'>;
}

/** rankRestaurants + rankEvents + (optionally) rankNightlife, then
 * solveNight over the ranked lists — the "Decide" step, already tested,
 * called here rather than reimplemented. */
export function rankAndSolveNight(inputs: RankAndSolveInputs): SolvedNight {
  const restaurants = rankRestaurants(inputs.restaurants.candidates, inputs.restaurants.ctx);
  const events = rankEvents(inputs.events.candidates, inputs.events.ctx);
  const nightlife = inputs.nightlife ? rankNightlife(inputs.nightlife.candidates, inputs.nightlife.ctx) : null;

  return solveNight({
    ...inputs.solve,
    restaurants,
    events,
    nightlife,
  });
}
