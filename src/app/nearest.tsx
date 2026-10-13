import { useRouter } from 'expo-router';

import { FoodHubRow } from '@/components/featured';
import { RaisedView } from '@/components/raised-surface';
import { SeeAllScreen } from '@/components/see-all';
import { EmptyState } from '@/components/ui';
import { useActiveCityName } from '@/lib/city';
import { useNearestPool } from '@/lib/use-nearest-pool';

/** The same city-anchor pool Home previews in three vertical rows.
 * The pool remains within five miles of the selected trip anchor; GPS refines
 * its order. Approximate curated distances carry a tilde when offline. */
export default function NearestScreen() {
  const router = useRouter();
  const ranked = useNearestPool();
  const city = useActiveCityName();

  return (
    <SeeAllScreen
      title="Nearest"
      glyph="walk"
      blurb={`${ranked.length} places within five miles of the ${city} trip anchor. Your location refines the order.`}>
      {ranked.length ? (
        <RaisedView className="overflow-hidden rounded-card">
          {ranked.map((entry, index) => {
            return (
              <FoodHubRow
                key={entry.href}
                name={entry.name}
                image={entry.image}
                meta={[entry.cuisine, entry.price, entry.distanceLabel].filter(Boolean).join(' · ')}
                last={index === ranked.length - 1}
                onPress={() => router.push(entry.href)}
              />
            );
          })}
        </RaisedView>
      ) : (
        <EmptyState
          title="The local catalog is loading"
          message="Nearby places appear here without needing GPS. Pull to refresh Home to check for updates."
        />
      )}
    </SeeAllScreen>
  );
}
