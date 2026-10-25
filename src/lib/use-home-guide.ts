import { useActiveCity } from '@/lib/city';
import { useNow } from '@/lib/clock';
import { currentEventListings } from '@/lib/data';
import { buildHomeGuide } from '@/lib/home-guide';
import { useNearbyPlaces } from '@/lib/use-regional-places';
import { useNearestPool } from '@/lib/use-nearest-pool';
import { useViatorPicks } from '@/lib/viator';

export function useHomeGuide() {
  const city=useActiveCity(),now=useNow(),nearest=useNearestPool(),{places,anchor,locationBased,includeOakland,displayCity,refresh}=useNearbyPlaces(),picks=useViatorPicks();
  const outsideBundle=city==='oakland'&&!includeOakland;
  return {catalog:buildHomeGuide({city,now,nearest,places,picks:outsideBundle?[]:picks,events:outsideBundle?[]:currentEventListings(now),anchor,includeOakland,locationBased}),now,city,nearest,displayCity,refreshRegional:refresh};
}
