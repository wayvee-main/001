// Which city the app is currently showing.
//
// The backend holds a catalog per city (see public.cities and the sync
// scripts), so every read of a catalog table has to say which one it wants.
// Without that, two launched cities interleave into one feed — and weather,
// which has one row per hour per city, would hand the app two readings for
// the same hour.
//
// The active city is one value, held here and persisted, rather than threaded
// through every query: the hydrators in places.ts, events-remote.ts,
// viator.ts and weather.ts read it directly, and changing it re-runs them.
import { useMemo, useSyncExternalStore } from 'react';

import { CITY_CENTER, type GeoPoint } from '@/lib/geo';

import { getStoredItem, setStoredItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

/** The city the shipped catalog in data.ts and events.ts describes.
 *
 * That catalog is hand-curated Oakland: restaurants, venues, nightlife and a
 * seeded event calendar, all compiled into the bundle. It is not a fallback
 * for other cities — a guest in San Jose should not be shown Oakland
 * restaurants because San Jose has not been curated yet. Code that mixes the
 * bundle with backend rows checks this first. */
export const BUNDLE_CITY = 'oakland';

/** Display name for BUNDLE_CITY. Named once so the picker's seed value and the
 * fallback below cannot drift apart. */
export const BUNDLE_CITY_NAME = 'Oakland';

const STORAGE_KEY = 'wayvee.city.v1';

export interface CityOption {
  slug: string;
  name: string;
  anchor_lat?: number;
  anchor_lon?: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

let active = BUNDLE_CITY;
let options: CityOption[] = [{ slug: BUNDLE_CITY, name: BUNDLE_CITY_NAME }];

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Non-hook read, for the hydrators and anything else outside React. */
export function activeCity(): string {
  return active;
}

function getActiveSnapshot(): string {
  return active;
}

export function useActiveCity(): string {
  return useSyncExternalStore(subscribe, getActiveSnapshot, getActiveSnapshot);
}

function getOptionsSnapshot(): CityOption[] {
  return options;
}

/** Launched cities, for the picker. Starts as the bundle's city alone and is
 * replaced once the backend answers, so the picker is never empty. */
export function useCityOptions(): CityOption[] {
  return useSyncExternalStore(subscribe, getOptionsSnapshot, getOptionsSnapshot);
}

/** The active city's display name, for copy that says where the guest is.
 *
 * Resolved against the launched list rather than stored alongside the slug:
 * the name is the backend's to change, and a stored copy would outlive it.
 * Falls back to the bundle's city, which is the one name that is always right
 * with no backend at all. */
export function useActiveCityName(): string {
  const slug = useActiveCity();
  const launched = useCityOptions();
  return launched.find((city) => city.slug === slug)?.name ?? BUNDLE_CITY_NAME;
}

/** Restores the stored choice at launch. Falls back to the bundle's city,
 * which is the one guaranteed to have content with no backend at all. */
export async function restoreActiveCity(): Promise<string> {
  try {
    const stored = await getStoredItem(STORAGE_KEY);
    if (stored && /^[a-z][a-z0-9-]{1,39}$/.test(stored)) {
      active = stored;
      notify();
    }
  } catch {
    // A failed read is not a reason to refuse to launch — the default stands.
  }
  return active;
}

/** Changes the city and persists it. Callers re-run the hydrators afterwards;
 * this module deliberately does not import them, since every one of them
 * imports this. */
export async function setActiveCity(slug: string): Promise<boolean> {
  if (slug === active) return false;
  active = slug;
  notify();
  try {
    await setStoredItem(STORAGE_KEY, slug);
  } catch {
    // Persistence is a convenience; the change still applies to this session.
  }
  return true;
}

/** A per-city cache key, so one city's cached snapshot can never be restored
 * into another city's session. */
export function cityCacheKey(base: string, slug: string = active): string {
  return `${base}.${slug}`;
}

/** Loads the launched city list. Failure leaves the existing options in place
 * — a guest with no network keeps the city they already had. */
export async function hydrateCitiesFromBackend(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.from('cities').select('slug, name, anchor_lat, anchor_lon').eq('launched', true).order('name');
    if (error || !data?.length) return false;

    options = (data as CityOption[]).filter((city) => city.slug && city.name);

    // A city that was launched when the guest last opened the app can be
    // unlaunched later. Falling back to the bundle's city keeps them on the
    // one city that works without a backend at all.
    if (!options.some((city) => city.slug === active)) {
      active = options.some((city) => city.slug === BUNDLE_CITY) ? BUNDLE_CITY : options[0].slug;
      void setStoredItem(STORAGE_KEY, active).catch(() => {});
    }
    notify();
    return true;
  } catch {
    return false;
  }
}

/** The selected market's configured ZIP/downtown reference, never the phone.
 * Oakland has a bundled reference; other cities use their own backend row. */
export function useActiveCityAnchor(): GeoPoint | null {
  const slug = useActiveCity();
  const cities = useCityOptions();
  const city = cities.find((option) => option.slug === slug);
  const lat = city?.anchor_lat;
  const lon = city?.anchor_lon;
  return useMemo(() => {
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }
    return slug === BUNDLE_CITY ? CITY_CENTER : null;
  }, [slug, lat, lon]);
}
