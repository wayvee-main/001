import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { FoodHubRow } from '@/components/featured';
import { RaisedView } from '@/components/raised-surface';
import { SeeAllScreen } from '@/components/see-all';
import { SectionHeading } from '@/components/section-heading';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import {
  EVENTS,
  NIGHTLIFE_SPOTS,
  RESTAURANTS,
  isEventToday,
  restaurantMetaLine,
  type ScoperEvent,
} from '@/lib/data';
import { formatMiles, milesBetween, usableAnchor } from '@/lib/geo';
import { openStateFor } from '@/lib/hours';
import { useCuratedCoords, useCuratedHours } from '@/lib/places';
import { useScoper } from '@/lib/store';

const PER_SECTION = 4;

/**
 * What the counts trail on Home is counting, opened out.
 *
 * That "See all" sits beside three separate numbers, so sending it to one
 * segment of Discover was always going to disappoint — this shows all three
 * pools, each with its own way through to the full list.
 *
 * Ordering here is deliberately not Home's taste ranking: this screen answers
 * "what is open and on right now", so open-state and start time are the honest
 * sorts. Taste belongs where the app is choosing for you, not where it is
 * listing what exists.
 */
export default function AroundScreen() {
  const router = useRouter();
  const s = useScoper();
  const now = useNow(60_000);
  const curatedHours = useCuratedHours();
  const curatedCoords = useCuratedCoords();
  const anchor = usableAnchor(s.deviceLocation);

  const openKitchens = useMemo(() => {
    return Object.values(RESTAURANTS)
      .map((restaurant) => {
        const state = openStateFor(curatedHours(restaurant) ?? restaurant.hours ?? null, now);
        const point = anchor ? curatedCoords(restaurant) : null;
        const miles = anchor && point ? milesBetween(anchor, point) : null;
        return { restaurant, state, miles };
      })
      .filter((entry): entry is typeof entry & { state: { status: 'open'; closesAt: string | null } } => entry.state.status === 'open')
      .map(({ restaurant, state, miles }) => ({ restaurant, closesAt: state.closesAt, miles }))
      // Nearest first where a real fix exists; otherwise the catalog's own
      // order, never a guessed distance.
      .sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity));
  }, [curatedHours, curatedCoords, anchor, now]);

  const showsTonight = useMemo(
    () => Object.values(EVENTS).filter((event: ScoperEvent) => isEventToday(event, now)),
    [now],
  );

  const openFoodHub = () => {
    s.resetFilters();
    router.push('/featured');
  };

  const sections = [
    {
      id: 'kitchens',
      title: 'Kitchens open',
      count: openKitchens.length,
      action: openFoodHub,
      empty: 'Nothing is showing open hours right now.',
      rows: openKitchens.slice(0, PER_SECTION).map(({ restaurant, closesAt, miles }, index, shown) => (
        <FoodHubRow
          key={restaurant.id}
          name={restaurant.name}
          image={restaurant.image}
          cue={closesAt ? `Open till ${closesAt}` : 'Open now'}
          meta={
            miles != null
              ? [restaurant.cuisine, restaurant.price, `${formatMiles(miles)} away`].join(' · ')
              : restaurantMetaLine(restaurant)
          }
          last={index === shown.length - 1}
          onPress={() => router.push(`/restaurant/${restaurant.id}`)}
        />
      )),
    },
    {
      id: 'shows',
      title: 'Shows tonight',
      count: showsTonight.length,
      action: () => router.push('/discover?mode=Events'),
      empty: 'No dated listings for tonight.',
      rows: showsTonight.slice(0, PER_SECTION).map((event, index, shown) => (
        <FoodHubRow
          key={event.id}
          name={event.name}
          image={event.image}
          cue={event.priceLabel}
          meta={`${event.time} · ${event.venue} · ${event.addr}`}
          last={index === shown.length - 1}
          onPress={() => router.push(`/event/${event.id}`)}
        />
      )),
    },
    {
      id: 'bars',
      title: 'Bars',
      count: NIGHTLIFE_SPOTS.length,
      action: () => router.push('/discover?mode=Nightlife'),
      empty: 'No bars in the catalog yet.',
      rows: NIGHTLIFE_SPOTS.slice(0, PER_SECTION).map((spot, index, shown) => (
        <FoodHubRow
          key={spot.id}
          name={spot.name}
          image={spot.image}
          meta={`${spot.kind} · ${spot.hours}`}
          last={index === shown.length - 1}
          onPress={() => router.push(`/night/${spot.id}`)}
        />
      )),
    },
  ];

  return (
    <SeeAllScreen
      title="Around you, right now"
      glyph="pin"
      blurb="The three counts from Home, opened out — each with its own way through to the rest.">
      {sections.map((section) => (
        <View key={section.id} className="gap-y-2.5">
          <SectionHeading
            title={section.title}
            action={section.count > PER_SECTION ? `All ${section.count}` : undefined}
            onPress={section.count > PER_SECTION ? section.action : undefined}
            note={section.count > 0 && section.count <= PER_SECTION ? `${section.count} in all` : undefined}
          />
          {section.rows.length ? (
            <RaisedView className="overflow-hidden rounded-card">{section.rows}</RaisedView>
          ) : (
            <EmptyState compact title={section.empty} message="Check back closer to the evening." />
          )}
        </View>
      ))}
    </SeeAllScreen>
  );
}
