import { useMemo } from 'react';
import { BUNDLE_CITY, useActiveCity, useActiveCityAnchor } from '@/lib/city';
import { RESTAURANTS } from '@/lib/data';
import { buildNearestPool } from '@/lib/nearest-pool';
import { useAllPlaces, useCuratedCoords } from '@/lib/places';
import { useScoper } from '@/lib/store';

export function useNearestPool() {
  const city = useActiveCity(), center = useActiveCityAnchor();
  const places = useAllPlaces(), coordsFor = useCuratedCoords();
  const device = useScoper((s) => s.deviceLocation);
  return useMemo(() => buildNearestPool({
    restaurants: city === BUNDLE_CITY ? Object.values(RESTAURANTS) : [],
    places, center, device, coordsFor, allowCuratedEstimates: city === BUNDLE_CITY,
  }), [city, center, places, device, coordsFor]);
}
