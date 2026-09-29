// Coordinates the fire-and-forget backend hydrations (events, places, Viator
// picks, weather) kicked off at launch — see events-remote.ts/places.ts/
// viator.ts/weather.ts.
// Each already falls back to the bundled catalog or a device cache when the
// network is slow or unreachable (CLAUDE.md #6: never breaks). This module
// just gives the arrival sequence and Home something to reactively watch —
// "is fresh content still in flight" — without ever blocking on it. Same
// useSyncExternalStore pattern as places.ts.
import { useSyncExternalStore } from 'react';

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

/** Starts every backend hydration exactly once per app session. */
export function startContentHydration(): Promise<void> {
  if (settledPromise) return settledPromise;
  settledPromise = Promise.all([
    hydrateEventsFromBackend().catch(() => undefined),
    hydratePlacesFromBackend().catch(() => undefined),
    hydrateViatorPicksFromBackend().catch(() => undefined),
    hydrateWeatherFromBackend().catch(() => undefined),
  ]).then(() => {
    hydrating = false;
    notify();
  });
  return settledPromise;
}
