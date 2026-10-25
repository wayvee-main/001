import { useMemo } from 'react';
import { BUNDLE_CITY, useActiveCity, useActiveCityAnchor } from '@/lib/city';
import { RESTAURANTS } from '@/lib/data';
import { buildNearestPool } from '@/lib/nearest-pool';
import { useCuratedCoords } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { useNearbyPlaces } from '@/lib/use-regional-places';

export function useNearestPool() {
  const city = useActiveCity(), center = useActiveCityAnchor();
  const {places,anchor,locationBased} = useNearbyPlaces(), coordsFor = useCuratedCoords();
  const device = useScoper((s) => s.deviceLocation);
  return useMemo(() => buildNearestPool({
    restaurants: city === BUNDLE_CITY ? Object.values(RESTAURANTS) : [],
    places, center:anchor||center, device, coordsFor, allowCuratedEstimates: city === BUNDLE_CITY&&!locationBased,
  }), [city, center, anchor, places, device, coordsFor,locationBased]);
}
