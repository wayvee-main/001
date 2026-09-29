// Runtime hydration for the hourly forecast in public.weather_hourly, filled
// by scripts/sync-weather.ts from the US National Weather Service.
//
// "Right now is live" (CLAUDE.md #3) lists weather alongside time of day and
// open-now. This is the weather half: one real, attributable forecast for the
// downtown anchor, never a guess and never a client call to a third-party host
// that could be down when a guest opens the app.
//
// Staleness is handled by omission, not by extrapolation: if no stored period
// actually covers the current hour — the sync has been down, or the device has
// been offline long enough for the cache to age out — every read returns null
// and the UI simply says nothing about the weather. A forecast from yesterday
// presented as "right now" would be exactly the invented data CLAUDE.md rules
// out.
import { useSyncExternalStore } from 'react';

import { activeCity, cityCacheKey } from '@/lib/city';
import { getStoredItem, setStoredItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export interface WeatherHour {
  startsAt: string; // ISO
  endsAt: string; // ISO
  temperatureF: number;
  shortForecast: string;
  /** Percent, when NWS published one for this period — null is "not forecast",
   * never "zero chance". */
  precipProbability: number | null;
  windLabel: string | null;
  isDaytime: boolean;
}

interface WeatherRow {
  starts_at: string;
  ends_at: string;
  temperature_f: number;
  short_forecast: string;
  precip_probability: number | null;
  wind_label: string | null;
  is_daytime: boolean;
}

function rowToHour(row: WeatherRow): WeatherHour {
  return {
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    temperatureF: row.temperature_f,
    shortForecast: row.short_forecast,
    precipProbability: row.precip_probability,
    windLabel: row.wind_label,
    isDaytime: row.is_daytime,
  };
}

/** A day of forecast is all any surface reads — see HOURS_AHEAD in the sync. */
const FETCH_LIMIT = 24;

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: WeatherHour[] = [];

function publish(hours: WeatherHour[]): void {
  snapshot = [...hours].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WeatherHour[] {
  return snapshot;
}

/** Every hydrated forecast period, earliest first. */
export function useWeatherHours(): WeatherHour[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The period covering `now`, or null when none does — see the staleness note
 * in the header. Callers must render nothing on null. */
export function weatherAt(now = new Date(), hours: WeatherHour[] = snapshot): WeatherHour | null {
  const stamp = now.getTime();
  return (
    hours.find((hour) => {
      const start = Date.parse(hour.startsAt);
      const end = Date.parse(hour.endsAt);
      return Number.isFinite(start) && Number.isFinite(end) && stamp >= start && stamp < end;
    }) ?? null
  );
}

/** Reactive form of weatherAt — re-renders once the forecast lands. */
export function useWeatherNow(now = new Date()): WeatherHour | null {
  return weatherAt(now, useWeatherHours());
}

/** Percent at or above which rain is worth naming. Below this, NWS's own
 * hourly numbers are noise on a Bay Area summer afternoon. */
const PRECIP_MENTION_THRESHOLD = 20;

/** '68° · Partly Cloudy' — and '· 40% rain' only when the forecast is high
 * enough to change what a guest would do about it. */
export function weatherLine(hour: WeatherHour): string {
  const parts = [`${hour.temperatureF}°`, hour.shortForecast];
  if (hour.precipProbability != null && hour.precipProbability >= PRECIP_MENTION_THRESHOLD) {
    parts.push(`${hour.precipProbability}% rain`);
  }
  return parts.join(' · ');
}

/** How much daylight is left, read from NWS's own `isDaytime` flag rather than
 * computed — the last unbroken daytime period from `now` ends at last light.
 *
 * NWS publishes these on hour boundaries, so the answer is hour-granular: this
 * returns the boundary itself and leaves it to the caller to say "about". Null
 * when there is no forecast covering `now`, or when `now` is already dark —
 * both render as nothing shown, never as a guessed sunset. */
export function daylightRemaining(
  now = new Date(),
  hours: WeatherHour[] = snapshot,
): { startsAt: Date; endsAt: Date; minutesLeft: number } | null {
  const current = weatherAt(now, hours);
  if (!current || !current.isDaytime) return null;

  const ordered = [...hours].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  // Walk forward to last light, then backward to first light. A gap in the
  // forecast ends the run either way — we can't claim daylight across hours we
  // were never told about.
  let lastLight = Date.parse(current.endsAt);
  for (const hour of ordered) {
    const start = Date.parse(hour.startsAt);
    if (!Number.isFinite(start) || start < lastLight) continue;
    if (start > lastLight || !hour.isDaytime) break;
    lastLight = Date.parse(hour.endsAt);
  }

  let firstLight = Date.parse(current.startsAt);
  for (const hour of [...ordered].reverse()) {
    const end = Date.parse(hour.endsAt);
    if (!Number.isFinite(end) || end > firstLight) continue;
    if (end < firstLight || !hour.isDaytime) break;
    firstLight = Date.parse(hour.startsAt);
  }

  const minutesLeft = Math.round((lastLight - now.getTime()) / 60_000);
  return minutesLeft > 0
    ? { startsAt: new Date(firstLight), endsAt: new Date(lastLight), minutesLeft }
    : null;
}

/** Reactive form of daylightRemaining. */
export function useDaylightRemaining(now = new Date()) {
  return daylightRemaining(now, useWeatherHours());
}

// Which city the current contents describe. Null means nothing has loaded yet;
// a different slug means the guest changed city and what is held belongs to the
// city they left.
let hydratedCity: string | null = null;

// Last-known-good snapshot for offline cold launches, same pattern as
// places.ts/events-remote.ts. Weather ages out faster than any other cached
// content here, which is exactly why weatherAt() checks each period's own
// window instead of trusting that a cache hit means current data.
const CACHE_BASE = 'wayvee.weather.cache.v1';

function isWeatherHour(value: unknown): value is WeatherHour {
  const v = value as Partial<WeatherHour> | null;
  return Boolean(
    v && typeof v.startsAt === 'string' && typeof v.endsAt === 'string' && typeof v.temperatureF === 'number' && typeof v.shortForecast === 'string',
  );
}

async function loadWeatherFromCache(): Promise<boolean> {
  const raw = await getStoredItem(cityCacheKey(CACHE_BASE));
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    const hours = parsed.filter(isWeatherHour);
    if (!hours.length) return false;
    publish(hours);
    return true;
  } catch {
    return false;
  }
}

/** Fetch the stored forecast. Returns true when the snapshot changed.
 * Pass force=true (pull-to-refresh) to bypass the one-shot guard. */
export async function hydrateWeatherFromBackend(force = false): Promise<boolean> {
  const city = activeCity();
  const hydrated = hydratedCity === city;
  if (hydrated && !force) return false;
  if (hydratedCity !== null && !hydrated) publish([]);
  if (!supabase) return hydrated ? false : loadWeatherFromCache();
  try {
    // An hour of slack keeps the period covering "now" in the result right up
    // to the moment it ends — the same cutoff the sync prunes on.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('weather_hourly')
      .select('*')
      .eq('city', city)
      .gte('starts_at', since)
      .order('starts_at', { ascending: true })
      .limit(FETCH_LIMIT);
    if (error || !data?.length) return hydrated ? false : loadWeatherFromCache();

    publish((data as unknown as WeatherRow[]).map(rowToHour));
    hydratedCity = city;
    void setStoredItem(cityCacheKey(CACHE_BASE), JSON.stringify(snapshot)).catch(() => {});
    return true;
  } catch {
    return hydrated ? false : loadWeatherFromCache();
  }
}
