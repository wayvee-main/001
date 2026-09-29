// Coordinates the fire-and-forget backend hydrations (events, places, Viator
// picks, weather) kicked off at launch — see events-remote.ts/places.ts/
// viator.ts/weather.ts.
// Each already falls back to the bundled catalog or a device cache when the
// network is slow or unreachable (CLAUDE.md #6: never breaks). This module
// just gives the arrival sequence and Home something to reactively watch —
// "is fresh content still in flight" — without ever blocking on it. Same
// useSyncExternalStore pattern as places.ts.
import { useSyncExternalStore } from 'react';

import { activeCity, hydrateCitiesFromBackend, restoreActiveCity, setActiveCity } from '@/lib/city';
import { applyCurationForCity } from '@/lib/curation';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { hydrateViatorPicksFromBackend } from '@/lib/viator';
import { hydrateWeatherFromBackend } from '@/lib/weather';

type Listener = () => void;
const listeners = new Set<Listener>();
let hydrating = true;
let settledPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return hydrating;
}

/** True while the initial fetch of events/places/Viator picks/weather is still
 * in flight — false once they have all settled (fetched, cached, or failed). */
export function useContentHydrating(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function hydrateCatalog(force = false): Promise<unknown> {
  return Promise.all([
    hydrateEventsFromBackend(force).catch(() => undefined),
    hydratePlacesFromBackend(force).catch(() => undefined),
    hydrateViatorPicksFromBackend(force).catch(() => undefined),
    hydrateWeatherFromBackend(force).catch(() => undefined),
  ]);
}

/** Starts every backend hydration exactly once per app session.
 *
 * The city is settled first, and synchronously as far as the hydrators are
 * concerned: they each read the active city when they run, so restoring the
 * stored choice has to happen before any of them start or the first fetch of
 * the session goes out for the wrong city. The launched-city list is fetched
 * alongside the catalog rather than before it, since it only feeds the
 * picker. */
export function startContentHydration(): Promise<void> {
  if (settledPromise) return settledPromise;
  settledPromise = restoreActiveCity()
    .catch(() => activeCity())
    .then((city) => {
      applyCurationForCity(city);
      return Promise.all([hydrateCatalog(), hydrateCitiesFromBackend().catch(() => undefined)]);
    })
    .then(() => {
      hydrating = false;
      notify();
    });
  return settledPromise;
}

/** Switches city and reloads everything that depends on it.
 *
 * Returns false when the city did not change. The catalog is force-hydrated
 * because each hydrator's "already done" check is per city — without force, a
 * city the guest had visited earlier in the session would keep whatever it
 * had, including rows since pruned. */
export async function switchCity(slug: string): Promise<boolean> {
  if (!(await setActiveCity(slug))) return false;
  applyCurationForCity(slug);
  hydrating = true;
  notify();
  await hydrateCatalog(true);
  hydrating = false;
  notify();
  return true;
}
