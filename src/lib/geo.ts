// Real-distance helpers for anything with known coordinates — device GPS
// fixes and Place rows (lat/lon sourced from Overture Maps + OpenStreetMap,
// see scripts/sync-places.ts). Never estimates or geocodes a coordinate;
// only computes over values that are already real, matching the "no
// invented data" rule in CLAUDE.md. Curated Restaurant/Venue entries carry
// no coordinates of their own (hand-picked, not geocoded); where the same
// spot exists in the places table, coordsForCurated() in lib/places.ts
// borrows those real coordinates, and where it doesn't the curated
// distanceLabel estimate stays the only signal (distanceMinutes() in
// lib/data.ts).

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MILES = 3958.8;

/** 12th St / Broadway (Oakland City Center BART) — same anchor as ANCHOR in
 * scripts/sync-ticketmaster.ts and scripts/sync-weather.ts. */
export const CITY_CENTER: GeoPoint = { latitude: 37.8032, longitude: -122.2716 };

/** Bay Area commute range. Beyond this, a device fix isn't "close enough to
 * refine" the neutral Downtown Oakland anchor (see lib/data.ts) — it's a
 * guest browsing from elsewhere, and real distance/walk-time from them would
 * be noise, not a signal. */
export const SERVICE_RADIUS_MILES = 60;

export function isInServiceArea(point: GeoPoint): boolean {
  return milesBetween(CITY_CENTER, point) <= SERVICE_RADIUS_MILES;
}

/** A device fix worth measuring distance from — null if missing or too far
 * from Downtown Oakland to mean anything (see SERVICE_RADIUS_MILES). Callers
 * that want the raw fix regardless of distance (reverse-geocoded label, maps
 * directions) should keep using the location directly instead of this. */
export function usableAnchor(point: GeoPoint | null | undefined): GeoPoint | null {
  if (!point) return null;
  return isInServiceArea(point) ? point : null;
}

/** Great-circle distance in miles between two real coordinate pairs (haversine). */
export function milesBetween(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "0.3 mi" under 10 miles, "12 mi" beyond — matches the existing curated
 * distanceLabel style ("0.7 mi") used across restaurant cards. */
export function formatMiles(miles: number): string {
  if (miles < 0.1) return 'Here';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

const WALK_MPH = 3;

/** Minutes on foot for a real distance, at an average walking pace — matches
 * the "N min walk" phrasing already used across the curated catalog (see
 * distanceMinutes() in lib/data.ts). Never applied to an estimated distance. */
export function walkMinutes(miles: number): number {
  return Math.max(1, Math.round((miles / WALK_MPH) * 60));
}
