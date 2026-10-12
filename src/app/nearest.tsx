import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { FoodHubRow } from '@/components/featured';
import { RaisedView } from '@/components/raised-surface';
import { SeeAllScreen } from '@/components/see-all';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { RESTAURANTS } from '@/lib/data';
import { formatMiles, usableAnchor } from '@/lib/geo';
import { openBadgeLabel, nearestOnFoot } from '@/lib/nearby-pool';
import { openStateFor } from '@/lib/hours';
import { useCuratedCoords, useCuratedHours } from '@/lib/places';
import { useScoper } from '@/lib/store';

/**
 * Home's "Nearest" rail, opened out.
 *
 * Home shows the nearest three; this is the same ordering over the whole
 * catalog, so the rail and the screen can never disagree about what is
 * closest. Both call nearestOnFoot — the ranking lives in one place.
 *
 * A place we cannot measure never appears, here or on Home: the ordering is
 * a claim about distance, and an unplotted restaurant has none. When
 * location has not resolved there is nothing to rank at all, which is why
 * this can be legitimately empty rather than falling back to an arbitrary
 * order dressed up as a distance.
 */
export default function NearestScreen() {
  const router = useRouter();
  const s = useScoper();
  const now = useNow();
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();

  const anchor = useMemo(() => usableAnchor(s.deviceLocation), [s.deviceLocation]);
  const ranked = useMemo(
    () => nearestOnFoot(Object.values(RESTAURANTS), curatedCoords, anchor),
    [curatedCoords, anchor],
  );

  return (
    <SeeAllScreen
      title="Nearest to you"
      glyph="walk"
      blurb="Every place we can measure a distance to, closest first.">
      {ranked.length ? (
        <RaisedView className="overflow-hidden rounded-card">
          {ranked.map((entry, index) => {
            const state = openStateFor(
              curatedHours(entry.restaurant) ?? entry.restaurant.hours ?? null,
              now,
            );
            return (
              <FoodHubRow
                key={entry.restaurant.id}
                name={entry.restaurant.name}
                image={entry.restaurant.image}
                cue={openBadgeLabel(state) ?? undefined}
                meta={`${formatMiles(entry.miles)} · ${entry.restaurant.cuisine} · ${entry.restaurant.price}`}
                last={index === ranked.length - 1}
                onPress={() => router.push(`/restaurant/${entry.restaurant.id}`)}
              />
            );
          })}
        </RaisedView>
      ) : (
        <EmptyState
          title="No distances yet"
          message="Distances need your location. Allow it and this fills in."
        />
      )}
    </SeeAllScreen>
  );
}
