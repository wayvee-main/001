// Scopes the hand-curated catalog to the city it was written for.
//
// RESTAURANTS, VENUES, CRAWLS and NIGHTLIFE_SPOTS in data.ts are Oakland,
// written by hand and compiled into the bundle. They are not a fallback: a
// guest who has switched to San Jose should not be shown Oakland restaurants
// as though they were local, and the app has no San Jose curation to put
// there instead. Until a city has its own, it gets what the backend actually
// holds for it — the bulk places directory, synced events, weather, tours —
// and nothing hand-written.
//
// This empties and refills those collections in place rather than wrapping
// them, because they are read directly in something like two hundred places
// across the app. Gating every one of those reads would be a far larger and
// more error-prone change than owning the question here, and data.ts has to
// stay dependency-free (scripts/audit-app.mjs asserts it), so the scoping
// cannot live there.
import { BUNDLE_CITY } from '@/lib/city';
import { CRAWLS, NIGHTLIFE_SPOTS, RESTAURANTS, VENUES } from '@/lib/data';

// Captured at module load, before anything can have changed them.
const BUNDLED_RESTAURANTS = { ...RESTAURANTS };
const BUNDLED_VENUES = { ...VENUES };
const BUNDLED_CRAWLS = { ...CRAWLS };
const BUNDLED_NIGHTLIFE = [...NIGHTLIFE_SPOTS];

function replaceRecord<T>(target: Record<string, T>, source: Record<string, T> | null): void {
  for (const key of Object.keys(target)) delete target[key];
  if (source) Object.assign(target, source);
}

/** Makes the curated catalog describe `city`, which today means Oakland's
 * catalog for Oakland and an empty one everywhere else. Safe to call
 * repeatedly; calling it with the bundle's city restores the full catalog. */
export function applyCurationForCity(city: string): void {
  const curated = city === BUNDLE_CITY;
  replaceRecord(RESTAURANTS, curated ? BUNDLED_RESTAURANTS : null);
  replaceRecord(VENUES, curated ? BUNDLED_VENUES : null);
  replaceRecord(CRAWLS, curated ? BUNDLED_CRAWLS : null);
  NIGHTLIFE_SPOTS.length = 0;
  if (curated) NIGHTLIFE_SPOTS.push(...BUNDLED_NIGHTLIFE);
}

/** True when the active city has a hand-curated catalog behind it. Surfaces
 * can use this to say "we have not curated this city yet" rather than render
 * an empty list that reads as a loading failure. */
export function hasCuratedCatalog(city: string): boolean {
  return city === BUNDLE_CITY;
}
