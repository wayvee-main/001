import { useActiveCity } from '@/lib/city';
import { useNow } from '@/lib/clock';
import { currentEventListings } from '@/lib/data';
import { buildHomeGuide } from '@/lib/home-guide';
import { useAllPlaces } from '@/lib/places';
import { useNearestPool } from '@/lib/use-nearest-pool';
import { useViatorPicks } from '@/lib/viator';

export function useHomeGuide() {
  const city=useActiveCity(),now=useNow(),nearest=useNearestPool(),places=useAllPlaces(),picks=useViatorPicks();
  return {catalog:buildHomeGuide({city,now,nearest,places,picks,events:currentEventListings(now)}),now,city};
}
