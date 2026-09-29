// Hourly weather for the Downtown Oakland anchor, from the US National Weather
// Service (api.weather.gov). Public domain, no API key, no paid tier — and,
// unlike every commercial weather API, no terms that forbid storing the result.
//
// Fills public.weather_hourly (see the migration for why this is a backend sync
// and not a client fetch). Requires env:
//   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
//
// Nothing here is derived or smoothed: each row is one NWS forecast period,
// carried across as published. Fields NWS omits (a null probabilityOfPrecipitation,
// for instance) stay null rather than being filled with a zero that would read
// as a real forecast of "no rain".
import { withSyncRun, serviceClient, type SyncOutcome } from './lib/sync-run';

// 12th St / Broadway — the same downtown anchor scripts/sync-ticketmaster.ts
// measures from, so "the weather" and "how far" describe one place.
const ANCHOR = { latitude: 37.8032, longitude: -122.2716 };

// NWS asks every caller to identify itself with a contact; an unidentified
// request gets a 403. https://www.weather.gov/documentation/services-web-api
const HEADERS = {
  'User-Agent': 'Wayvee-weather-sync/1.0 (+https://wayvee.app)',
  Accept: 'application/geo+json',
};

/** How far ahead to store. A day of hours covers every surface that asks
 * "what's it like right now / later tonight" without hoarding a week of
 * forecast the app never reads. */
const HOURS_AHEAD = 24;

interface NwsPointsResponse {
  properties?: { forecastHourly?: string };
}

interface NwsPeriod {
  startTime?: string;
  endTime?: string;
  temperature?: number;
  temperatureUnit?: string;
  probabilityOfPrecipitation?: { value?: number | null };
  windSpeed?: string;
  shortForecast?: string;
  isDaytime?: boolean;
}

interface NwsForecastResponse {
  properties?: { periods?: NwsPeriod[] };
}

/** NWS returns 500s and 503s under load often enough that a single attempt is
 * not a fair test of whether the service is up — same retry discipline as the
 * Overpass calls in scripts/sync-places.ts. */
async function fetchJson<T>(url: string): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error as Error;
      console.warn(`  weather fetch failed (try ${attempt + 1}/3):`, lastError.message.slice(0, 200));
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error(`weather fetch failed: ${url}`);
}

const client = serviceClient('sync weather');

void withSyncRun(client, 'weather', async (): Promise<SyncOutcome> => {
  // The gridpoint a coordinate belongs to is stable, but resolving it each run
  // costs one cheap request and means a grid change never silently strands the
  // sync on a dead forecast URL.
  const pointsUrl = `https://api.weather.gov/points/${ANCHOR.latitude},${ANCHOR.longitude}`;
  const points = await fetchJson<NwsPointsResponse>(pointsUrl);
  const forecastUrl = points.properties?.forecastHourly;
  if (!forecastUrl) throw new Error(`no forecastHourly URL in ${pointsUrl}`);

  const forecast = await fetchJson<NwsForecastResponse>(forecastUrl);
  const periods = forecast.properties?.periods ?? [];
  if (!periods.length) throw new Error('forecast returned no periods');

  const rows = periods
    .slice(0, HOURS_AHEAD)
    .filter(
      (period): period is NwsPeriod & { startTime: string; endTime: string; temperature: number; shortForecast: string } =>
        // Fahrenheit is what every US NWS office publishes, but the field is
        // explicit in the response — if it ever isn't F, drop the period rather
        // than store a Celsius number in a column named temperature_f.
        Boolean(period.startTime && period.endTime && period.shortForecast) &&
        typeof period.temperature === 'number' &&
        (period.temperatureUnit ?? 'F') === 'F',
    )
    .map((period) => ({
      starts_at: new Date(period.startTime).toISOString(),
      ends_at: new Date(period.endTime).toISOString(),
      temperature_f: Math.round(period.temperature),
      short_forecast: period.shortForecast,
      precip_probability:
        typeof period.probabilityOfPrecipitation?.value === 'number'
          ? Math.round(period.probabilityOfPrecipitation.value)
          : null,
      wind_label: period.windSpeed ?? null,
      is_daytime: period.isDaytime ?? true,
      source_url: forecastUrl,
      fetched_at: new Date().toISOString(),
    }));

  if (!rows.length) throw new Error(`no usable periods in ${periods.length} returned`);

  const { error: upsertError } = await client.from('weather_hourly').upsert(rows);
  if (upsertError) throw new Error(`upsert failed: ${upsertError.message}`);

  // Anything that has already elapsed is dead weight. One hour of slack keeps
  // the period covering "now" alive right up to the moment it ends.
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { error: pruneError, count } = await client
    .from('weather_hourly')
    .delete({ count: 'exact' })
    .lt('starts_at', cutoff);
  if (pruneError) console.warn('prune warning:', pruneError.message);

  const dropped = Math.min(periods.length, HOURS_AHEAD) - rows.length;
  console.log(`synced ${rows.length} hourly periods (${dropped} dropped), pruned ${count ?? 0} elapsed`);

  return {
    status: dropped > 0 ? 'partial' : 'ok',
    rowsWritten: rows.length,
    rowsPruned: count ?? 0,
    detail: dropped > 0 ? `${dropped} periods dropped as unusable` : `through ${rows[rows.length - 1].starts_at}`,
  };
});
