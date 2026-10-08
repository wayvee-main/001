import { useRouter } from 'expo-router';

import { FoodHubRow } from '@/components/featured';
import { RaisedView } from '@/components/raised-surface';
import { SeeAllScreen } from '@/components/see-all';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { formatMiles } from '@/lib/geo';
import { openBadgeLabel } from '@/lib/nearby-pool';
import { openStateFor } from '@/lib/hours';
import { useCuratedHours } from '@/lib/places';
import { useActiveCityName } from '@/lib/city';
import { useNearestPlaces } from '@/lib/use-nearest-places';
import { useScoper } from '@/lib/store';

/** The same five-mile city-reference pool and GPS ordering as Home. */
export default function NearestScreen() {
  const router = useRouter();
  const s = useScoper();
  const now = useNow();
  const cityName = useActiveCityName();
  const curatedHours = useCuratedHours();

  const ranked = useNearestPlaces();

  return (
    <SeeAllScreen
      title={s.deviceLocation ? "Nearest to you" : `Nearest in ${cityName}`}
      glyph="walk"
      blurb={`Places within 5 miles of the ${cityName} reference. Distances are straight-line, ${s.deviceLocation ? "from your location" : "from the city reference"}.`}>
      {ranked.length ? (
        <RaisedView className="overflow-hidden rounded-card">
          {ranked.map((entry, index) => {
            const state = openStateFor(
              curatedHours({ name: entry.name, address: entry.address }) ?? entry.hours,
              now,
            );
            return (
              <FoodHubRow
                key={entry.key}
                name={entry.name}
                image={entry.image}
                cue={openBadgeLabel(state) ?? undefined}
                meta={[formatMiles(entry.miles), entry.cuisine, entry.price].filter(Boolean).join(' · ')}
                last={index === ranked.length - 1}
                onPress={() => router.push(entry.href)}
              />
            );
          })}
        </RaisedView>
      ) : (
        <EmptyState
          title="No nearby places loaded yet"
          message="Pull to refresh Home to load the local catalog. Location permission is optional."
        />
      )}
    </SeeAllScreen>
  );
}
