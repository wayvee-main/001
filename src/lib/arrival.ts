import { deleteStoredItem, getStoredItem, setStoredItem } from '@/lib/storage';

// Device-local record of the arrival sequence: whether it has run, and the two
// answers it collects that aren't already stored elsewhere (taste tags go
// through taste-onboarding.ts, location through location.ts).
//
// Device-local rather than account-backed on purpose — the sequence runs before
// anyone has an account, and its whole promise is "no account needed".

const ARRIVAL_KEY = 'wayvee.arrival.v1';
const TRIP_CONTEXT_KEY = 'wayvee.trip-context.v1';
const WALK_BUDGET_KEY = 'wayvee.walk-budget.v1';

export type ArrivalStatus = 'unknown' | 'done';

/** What brings the guest to Oakland. Each value changes ranking, which is why
 * the sequence names the effect on screen instead of asking a personality
 * question — see TRIP_CONTEXT_EFFECTS below. */
export type TripContext = 'visiting' | 'work' | 'live';

export const TRIP_CONTEXTS: TripContext[] = ['visiting', 'work', 'live'];

/** How far a guest will walk. `null` means "whatever it takes" — distance still
 * sorts, it just never demotes (CLAUDE.md #2: sorting, never a filter). */
export type WalkBudget = 10 | 20 | null;

export async function restoreArrivalStatus(): Promise<ArrivalStatus> {
  return (await getStoredItem(ARRIVAL_KEY)) === 'done' ? 'done' : 'unknown';
}

export async function markArrivalDone(): Promise<void> {
  await setStoredItem(ARRIVAL_KEY, 'done');
}

export async function restoreTripContext(): Promise<TripContext | null> {
  const raw = await getStoredItem(TRIP_CONTEXT_KEY);
  return TRIP_CONTEXTS.includes(raw as TripContext) ? (raw as TripContext) : null;
}

export async function saveTripContext(context: TripContext | null): Promise<void> {
  if (context === null) {
    await deleteStoredItem(TRIP_CONTEXT_KEY);
    return;
  }
  await setStoredItem(TRIP_CONTEXT_KEY, context);
}

export async function restoreWalkBudget(): Promise<WalkBudget> {
  const raw = await getStoredItem(WALK_BUDGET_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return parsed === 10 || parsed === 20 ? parsed : null;
}

export async function saveWalkBudget(minutes: WalkBudget): Promise<void> {
  if (minutes === null) {
    await deleteStoredItem(WALK_BUDGET_KEY);
    return;
  }
  await setStoredItem(WALK_BUDGET_KEY, String(minutes));
}

/** The concrete, checkable promise each option makes. The arrival screen prints
 * these verbatim, and the ranker below has to actually honour them — a claim
 * here with no matching behaviour is the "Recommended for you" failure the
 * design doc exists to prevent. */
export const TRIP_CONTEXT_EFFECTS: Record<TripContext, { label: string; blurb: string; effect: string }> = {
  visiting: {
    label: 'Visiting',
    blurb: 'Oakland essentials, room to wander.',
    effect: 'Landmark venues move up and dinner defaults early enough that a show still fits.',
  },
  work: {
    label: 'Here for work',
    blurb: 'Efficient plans and shorter trips.',
    effect: 'Dinner defaults earlier and anything past a 20 minute walk gets demoted.',
  },
  live: {
    label: 'I live here',
    blurb: 'New openings and local favorites.',
    effect: 'Landmark venues move down so newer and lesser-known places surface first.',
  },
};

/** Venues a visitor would recognise from a guidebook. Used to raise them for
 * 'visiting' and lower them for 'live'. Kept here rather than in data.ts so the
 * catalog stays a catalog — this is a ranking opinion, not a fact about a place.
 *
 * Every id here has to exist in VENUES, or it silently ranks nothing —
 * `arrival-promises.test.ts` holds the list to that. 'omca' was listed for a
 * long time and never matched: there is no omca venue record, and the museum's
 * events carry `venue: 'OMCA campus'` with no venueId. It comes back the day a
 * real venue record exists for it, sourced like every other one. */
export const LANDMARK_VENUE_IDS = ['yoshis', 'fox', 'paramount'];

/** Default dinner hour by trip context, in 24h. Screen 2 promises "dinner
 * defaults to 6:30 so shows still fit" — this is that promise. */
export function defaultDinnerMinutes(context: TripContext | null): number | null {
  if (context === 'visiting') return 18 * 60 + 30;
  if (context === 'work') return 18 * 60;
  return null;
}
