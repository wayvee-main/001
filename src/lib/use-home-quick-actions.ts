import { useMemo } from 'react';

import { BUNDLE_CITY, useActiveCity, useActiveCityAnchor } from '@/lib/city';
import { RESTAURANTS } from '@/lib/data';
import { homeVenueActions } from '@/lib/home-quick-actions';
import { buildNearestPool } from '@/lib/nearest-pool';
import { hoursForCurated, useAllPlaces, useCuratedCoords } from '@/lib/places';
import { useScoper } from '@/lib/store';

/** Browse the whole local five-mile catalog for daypart matches, so a nearby
 * breakfast spot can surface even when it sits outside the first 24 nearest.
 * This does not change the membership or ordering of For you → Nearest. */
export function useHomeQuickActions(now: Date) {
  const city = useActiveCity(), center = useActiveCityAnchor();
  const places = useAllPlaces(), coordsFor = useCuratedCoords();
  const device = useScoper((state) => state.deviceLocation);
  return useMemo(() => {
    const restaurants = city === BUNDLE_CITY ? Object.values(RESTAURANTS) : [];
    const curated = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
    const local = new Map(places.map((place) => [place.id, place]));
    const nearby = buildNearestPool({ restaurants, places, center, device, coordsFor,
      allowCuratedEstimates: city === BUNDLE_CITY, limit: Number.MAX_SAFE_INTEGER });
    return homeVenueActions(nearby.map((pick) => {
      const restaurant = curated.get(pick.id), place = local.get(pick.id);
      return { id: pick.id, name: pick.name, href: pick.href, miles: pick.miles,
        category: place?.category ?? 'restaurant',
        terms: [pick.cuisine, ...(restaurant?.searchTags ?? []), ...(restaurant?.popularDishes.map((dish) => dish.name) ?? [])],
        openingHours: restaurant ? hoursForCurated(restaurant, places) : place?.openingHours ?? null,
        openLate: restaurant?.openLate ?? false };
    }), now);
  }, [city, center, places, device, coordsFor, now]);
}
