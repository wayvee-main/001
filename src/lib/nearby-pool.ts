// The pool behind Home's "More places nearby" carousel.
//
// Home's first rail is NEARBY_EATS_IDS, which is four ids — Nearby eats shows
// all four. So a second rail cannot re-slice that list without drawing the same
// four cards again; it has to come from the wider catalog, minus whatever the
// rails above already spent.
//
// Ordering is open-first, then nearest. A place whose hours are unknown is
// ranked last but never dropped and never labelled: `data.ts` leaves `hours`
// off several real restaurants, and the synced places table is the fresher
// source that may or may not fill the gap at call time. Ranking an unknown
// below a known open is a preference; calling it open would be an invention.

import type { Restaurant } from '@/lib/data';
import { milesBetween, type GeoPoint } from '@/lib/geo';

import type { Place } from '@/lib/places';

import type { OpenState } from '@/lib/hours';

export interface NearbyCandidate<T> {
  item: T;
  /** Straight-line miles from the guest, when both ends are known. */
  miles: number | null;
  state: OpenState;
}

/** Open beats unknown beats closed. Distance breaks ties, and an unmeasurable
 * distance sorts after a measured one rather than jumping the queue. */
function rankKey<T>(entry: NearbyCandidate<T>): [number, number] {
  const tier = entry.state.status === 'open' ? 0 : entry.state.status === 'unknown' ? 1 : 2;
  return [tier, entry.miles ?? Number.POSITIVE_INFINITY];
}

export function rankNearby<T>(candidates: NearbyCandidate<T>[], limit = 8): NearbyCandidate<T>[] {
  return [...candidates]
    .sort((a, b) => {
      const [at, ad] = rankKey(a);
      const [bt, bd] = rankKey(b);
      return at - bt || ad - bd;
    })
    .slice(0, limit);
}

/** The badge over the photo. Renders only what the hours actually say — an
 * unknown state gets no badge rather than a hedge. */
export function openBadgeLabel(state: OpenState): string | null {
  if (state.status === 'open') return state.closesAt ? `Open till ${state.closesAt}` : 'Open now';
  if (state.status === 'closed') return state.opensAt ? `Opens ${state.opensAt}` : 'Closed now';
  return null;
}

/** The meta line under the name: cuisine, then a measured distance when there
 * is one, else the catalog's own travel label, else nothing extra. */
export function nearbyMetaLine({
  cuisine,
  miles,
  distanceLabel,
}: {
  cuisine: string;
  miles: number | null;
  distanceLabel?: string;
}): string {
  const distance = miles != null ? `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi` : distanceLabel;
  return [cuisine, distance].filter(Boolean).join(' · ');
}

/** The catalog ordered by distance, nearest first.
 *
 * Nearest, not fastest: milesBetween is straight-line, so this knows which
 * place is closest but nothing about how you actually get there. It returns
 * the distance and leaves it at that — a walking time off a crow-flies
 * measurement would understate every route that is not a straight line.
 *
 * A place we cannot measure is dropped rather than ranked last: the ordering
 * is a claim about distance, and a place with no coordinates has none to make.
 * Returns an empty list when there is no anchor at all, which is the honest
 * answer before location resolves — the caller hides the section rather than
 * showing an arbitrary order (CLAUDE.md #6). */
export function nearestOnFoot(
  restaurants: Restaurant[],
  coordsFor: (entry: { name: string; address?: string | null }) => GeoPoint | null,
  anchor: GeoPoint | null,
): { restaurant: Restaurant; miles: number }[] {
  if (!anchor) return [];
  const measured: { restaurant: Restaurant; miles: number }[] = [];
  for (const restaurant of restaurants) {
    const point = coordsFor(restaurant);
    if (!point) continue;
    measured.push({ restaurant, miles: milesBetween(anchor, point) });
  }
  return measured.sort((a, b) => a.miles - b.miles);
}

export const NEAREST_RADIUS_MILES = 5;
export const NEAREST_HOME_LIMIT = 20;

export interface NearestPlace {
  key: string;
  name: string;
  image?: string;
  cuisine: string;
  address?: string | null;
  price?: string;
  hours: string | null;
  href: string;
  miles: number;
  referenceMiles: number;
}

function validPoint(point: GeoPoint): boolean {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

/** Membership is fixed around the selected ZIP/city reference. GPS changes
 * only ordering and displayed distances, never the five-mile pool. */
export function rankNearestPlaces(
  restaurants: Restaurant[],
  places: Place[],
  coordsFor: (entry: { name: string; address?: string | null }) => GeoPoint | null,
  reference: GeoPoint | null,
  phone: GeoPoint | null,
): NearestPlace[] {
  if (!reference || !validPoint(reference)) return [];
  const origin = phone && validPoint(phone) ? phone : reference;
  const result: NearestPlace[] = [];
  const seen = new Set<string>();
  const identity = (name: string, point: GeoPoint) =>
    `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${point.latitude.toFixed(3)}|${point.longitude.toFixed(3)}`;
  const add = (point: GeoPoint | null, item: Omit<NearestPlace, 'miles' | 'referenceMiles'>) => {
    if (!point || !validPoint(point)) return;
    const referenceMiles = milesBetween(reference, point);
    if (referenceMiles > NEAREST_RADIUS_MILES) return;
    const key = identity(item.name, point);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ ...item, referenceMiles, miles: milesBetween(origin, point) });
  };
  const curatedPoints: { name: string; point: GeoPoint }[] = [];
  for (const restaurant of restaurants) {
    const point = coordsFor(restaurant);
    add(point, {
      key: `restaurant:${restaurant.id}`, name: restaurant.name,
      image: restaurant.image || restaurant.menuHighlights?.find((item) => item.image)?.image,
      cuisine: restaurant.cuisine, address: restaurant.address, price: restaurant.price,
      hours: restaurant.hours ?? null, href: `/restaurant/${restaurant.id}`,
    });
    if (point && validPoint(point)) curatedPoints.push({ name: restaurant.name, point });
  }
  for (const place of places) {
    if (place.needsReview || !['restaurant', 'cafe', 'bakery', 'bar', 'pub', 'brewery', 'wine_bar', 'night_club'].includes(place.category)) continue;
    const point = { latitude: place.lat, longitude: place.lon };
    // The resolver matched this exact location to a curated record already.
    if (curatedPoints.some((known) => {
      const curatedName = known.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const placeName = place.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return known.point.latitude === point.latitude && known.point.longitude === point.longitude
        && (placeName === curatedName || placeName.startsWith(curatedName));
    })) continue;
    add(point, {
      key: `place:${place.id}`, name: place.name, image: place.image ?? undefined,
      cuisine: place.cuisine ?? place.category.replace(/_/g, ' '), address: place.address,
      hours: place.openingHours, href: `/place/${place.id}`,
    });
  }
  return result.sort((a, b) => a.miles - b.miles || a.key.localeCompare(b.key));
}
