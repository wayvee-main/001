import { useMemo } from 'react';

import { useActiveCityAnchor } from '@/lib/city';
import { RESTAURANTS } from '@/lib/data';
import { rankNearestPlaces } from '@/lib/nearby-pool';
import { useAllPlaces, useCuratedCoords } from '@/lib/places';
import { useScoper } from '@/lib/store';

/** Shared pool and ordering for Home and its full Nearest screen. */
export function useNearestPlaces() {
  const reference = useActiveCityAnchor();
  const places = useAllPlaces();
  const coordsFor = useCuratedCoords();
  const phone = useScoper((state) => state.deviceLocation);
  return useMemo(
    () => rankNearestPlaces(Object.values(RESTAURANTS), places, coordsFor, reference, phone),
    [places, coordsFor, reference, phone],
  );
}
