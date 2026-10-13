import type { Restaurant } from '@/lib/data';
import { formatMiles, milesBetween, type GeoPoint } from '@/lib/geo';
import type { Place } from '@/lib/places';

export interface NearestPick {
  id: string;
  name: string;
  cuisine: string;
  price?: string;
  image?: string;
  href: `/restaurant/${string}` | `/place/${string}`;
  miles: number;
  estimated: boolean;
  distanceLabel: string;
}

const keyFor = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/** City/ZIP anchor defines membership. A phone fix only reorders that pool.
 * Curated distance estimates are an Oakland-only offline fallback, explicitly
 * marked as estimates; they never masquerade as GPS measurements in another city. */
export function buildNearestPool({ restaurants, places, center, device, coordsFor, allowCuratedEstimates = false, limit = 24 }: {
  restaurants: Restaurant[];
  places: Place[];
  center: GeoPoint | null;
  device?: GeoPoint | null;
  coordsFor: (entry: { name: string; address?: string | null }) => GeoPoint | null;
  allowCuratedEstimates?: boolean;
  limit?: number;
}): NearestPick[] {
  if (!center) return [];
  const candidates: (NearestPick & { centerMiles: number; point: GeoPoint | null })[] = [];
  const seen = new Set<string>();
  for (const restaurant of restaurants) {
    const point = coordsFor(restaurant);
    const estimate = restaurant.distanceLabel.match(/^(\d+(?:\.\d+)?)\s*mi\b/i);
    const centerMiles = point ? milesBetween(center, point) : allowCuratedEstimates && estimate ? Number(estimate[1]) : null;
    if (centerMiles == null || centerMiles > 5) continue;
    seen.add(keyFor(restaurant.name));
    candidates.push({ id: restaurant.id, name: restaurant.name, cuisine: restaurant.cuisine,
      price: restaurant.price, image: restaurant.image, href: `/restaurant/${restaurant.id}`,
      miles: centerMiles, centerMiles, point, estimated: !point, distanceLabel: restaurant.distanceLabel });
  }
  for (const place of places) {
    if (!['restaurant', 'cafe', 'bakery'].includes(place.category) || place.needsReview || seen.has(keyFor(place.name))) continue;
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) continue;
    const point = { latitude: place.lat, longitude: place.lon }, centerMiles = milesBetween(center, point);
    if (centerMiles > 5) continue;
    seen.add(keyFor(place.name));
    candidates.push({ id: place.id, name: place.name, cuisine: place.cuisine || place.category,
      image: place.image || undefined, href: `/place/${place.id}`, miles: centerMiles,
      centerMiles, point, estimated: false, distanceLabel: formatMiles(centerMiles) });
  }
  const pool = candidates.sort((a,b) => a.centerMiles-b.centerMiles || a.name.localeCompare(b.name)).slice(0,limit);
  // A distant browsing location should not displace the trip's local context.
  const hasDevice = !!device && milesBetween(center, device) <= 60;
  const reference = hasDevice ? device! : center;
  return pool.map(({ point, centerMiles, ...pick }) => {
    const miles = point ? milesBetween(reference, point) : centerMiles;
    return { ...pick, miles, distanceLabel: `${pick.estimated ? '~' : ''}${formatMiles(miles)}` };
  }).sort((a,b) => (hasDevice ? Number(a.estimated)-Number(b.estimated) : 0) || a.miles-b.miles || a.name.localeCompare(b.name));
}
