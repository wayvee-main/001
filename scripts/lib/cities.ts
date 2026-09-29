// The city list every backend sync runs against.
//
// public.cities is the single source of truth for where Wayvee has a catalog:
// each row carries the anchor point the weather and distance syncs measure
// from, the bounding box the places sync queries by, and the Viator
// destination names that city's tours come from. Scripts read it instead of
// hardcoding coordinates, so adding a city is a row, not a patch to five
// files.
//
// `launched` is the gate. A city that exists here but is not launched is
// inert: no sync fetches for it and the app will not offer it. That is how a
// new city is staged — insert it, let its syncs backfill, then flip the flag.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CityBbox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface City {
  slug: string;
  name: string;
  timezone: string;
  anchor: { latitude: number; longitude: number };
  bbox: CityBbox;
  /** Ordered Viator destination names. Empty means this city has no Viator
   * coverage configured — its tours sync is a no-op rather than an error. */
  viatorDestinations: string[];
}

interface CityRow {
  slug: string;
  name: string;
  timezone: string;
  anchor_lat: number;
  anchor_lon: number;
  bbox_min_lat: number;
  bbox_min_lon: number;
  bbox_max_lat: number;
  bbox_max_lon: number;
  viator_destinations: string[] | null;
}

function toCity(row: CityRow): City {
  return {
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    anchor: { latitude: row.anchor_lat, longitude: row.anchor_lon },
    bbox: {
      minLat: row.bbox_min_lat,
      minLon: row.bbox_min_lon,
      maxLat: row.bbox_max_lat,
      maxLon: row.bbox_max_lon,
    },
    viatorDestinations: row.viator_destinations ?? [],
  };
}

/** Launched cities, in a stable order.
 *
 * WAYVEE_CITY restricts a run to one city by slug — for backfilling a city
 * that was just launched without re-fetching every other one, and for the
 * manual "Run workflow" button. An unknown or unlaunched slug is an error
 * rather than an empty run, because silently syncing nothing looks identical
 * to success in the sync_runs table. */
export async function launchedCities(client: SupabaseClient): Promise<City[]> {
  const { data, error } = await client
    .from('cities')
    .select('slug, name, timezone, anchor_lat, anchor_lon, bbox_min_lat, bbox_min_lon, bbox_max_lat, bbox_max_lon, viator_destinations')
    .eq('launched', true)
    .order('slug');

  if (error) throw new Error(`could not read cities: ${error.message}`);

  const cities = ((data ?? []) as CityRow[]).map(toCity);
  if (!cities.length) throw new Error('no launched cities — nothing to sync');

  const only = process.env.WAYVEE_CITY?.trim();
  if (!only) return cities;

  const picked = cities.find((city) => city.slug === only);
  if (!picked) {
    throw new Error(`WAYVEE_CITY=${only} is not a launched city (have: ${cities.map((c) => c.slug).join(', ')})`);
  }
  return [picked];
}
