import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailScreen, type DetailSection } from '@/components/detail-screen';
import { Screen } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedTouchable, RaisedView } from '@/components/raised-surface';
import { BackButton, ChevronRight } from '@/components/ui';
import {
  CURATED_COLLECTIONS,
  EVENTS,
  RESTAURANTS,
  VENUES,
  activeCollectionItems,
  eventDayGroupLabel,
  restaurantMetaLine,
} from '@/lib/data';
import { siteLogoLink } from '@/lib/links';
import { useThemeColors } from '@/lib/theme';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return Object.keys(CURATED_COLLECTIONS).map((id) => ({ id }));
}

export default function CuratedCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const collection = Object.values(CURATED_COLLECTIONS).find((candidate) => candidate.id === id);
  const colors = useThemeColors();

  if (!collection) {
    return (
      <Screen>
        <View className="mx-auto w-full max-w-[720px] flex-1 px-5">
          <BackButton />
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <Text className="font-fraunces text-display text-ink">Collection unavailable</Text>
            <Text className="mt-2 text-center font-dm text-body text-taupe">
              Browse the current Oakland shortlists instead.
            </Text>
            <TouchableOpacity onPress={() => router.replace('/collection')} className="mt-5 rounded-full bg-ember px-5 py-3">
              <Text className="font-dm-medium text-label text-white">Browse collections</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  const items = activeCollectionItems(collection);
  const venue = collection.venueId ? VENUES[collection.venueId] : undefined;

  const sections: DetailSection[] = [{
    key: 'picks',
    title: 'Current picks',
    note: items.length ? `${items.length} active` : undefined,
    children: items.length ? (
      <RaisedView className="overflow-hidden rounded-card px-3.5">
        {items.map((item, index) => {
          const divider = index < items.length - 1 ? 'border-b border-sand' : '';
          if (item.type === 'restaurant') {
            const restaurant = RESTAURANTS[item.id];
            if (!restaurant) return null;
            return (
              <TouchableOpacity
                key={`restaurant-${restaurant.id}`}
                accessibilityRole="button"
                accessibilityLabel={`View ${restaurant.name}`}
                activeOpacity={0.7}
                onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                className={`flex-row items-center gap-x-3 py-3 ${divider}`}>
                <Photo uri={restaurant.image} radius={9} style={{ width: 58, height: 58 }} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="font-dm-bold text-body text-ink">{restaurant.name}</Text>
                  <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                    {item.note ?? restaurantMetaLine(restaurant)}
                  </Text>
                  <Text numberOfLines={1} className="mt-0.5 font-dm-medium text-meta text-pine">{restaurant.hoursShort}</Text>
                </View>
                <ChevronRight color={colors.peach} strokeWidth={1.8} />
              </TouchableOpacity>
            );
          }

          const event = EVENTS[item.id];
          if (!event) return null;
          return (
            <TouchableOpacity
              key={`event-${event.id}`}
              accessibilityRole="button"
              accessibilityLabel={`View ${event.name}`}
              activeOpacity={0.7}
              onPress={() => router.push(`/event/${event.id}`)}
              className={`flex-row items-center gap-x-3 py-3 ${divider}`}>
              <Photo uri={event.image} radius={9} style={{ width: 58, height: 58 }} />
              <View className="min-w-0 flex-1">
                <Text className="font-dm-bold text-micro tracking-[0.55px] text-peach">
                  {eventDayGroupLabel(event).toUpperCase()}
                </Text>
                <Text numberOfLines={1} className="mt-0.5 font-dm-bold text-body text-ink">{event.name}</Text>
                <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                  {event.time} · {event.venue} · {event.priceLabel}
                </Text>
              </View>
              <ChevronRight color={colors.peach} strokeWidth={1.8} />
            </TouchableOpacity>
          );
        })}
      </RaisedView>
    ) : (
      <RaisedView className="items-center rounded-card px-5 py-7">
        <Text className="font-dm-medium text-body text-ink">This shortlist has ended.</Text>
        <Text className="mt-1 text-center font-dm text-label text-taupe">Expired listings have been removed.</Text>
        <TouchableOpacity onPress={() => router.replace('/discover')} className="mt-3 rounded-full bg-ember px-4 py-2.5">
          <Text className="font-dm-medium text-label text-white">See current events</Text>
        </TouchableOpacity>
      </RaisedView>
    ),
  }];

  if (venue && items.length) {
    sections.push({
      key: 'venue',
      children: (
        <RaisedTouchable
          accessibilityRole="button"
          accessibilityLabel={`View ${venue.name}`}
          activeOpacity={0.72}
          onPress={() => router.push(`/venue/${venue.id}`)}
          className="flex-row items-center gap-x-3 rounded-card px-3.5 py-3">
          <Photo
            uri={siteLogoLink(venue.sourceUrl)}
            fit="contain"
            stripedPlaceholder={false}
            radius={0}
            style={{ width: 42, height: 42, backgroundColor: 'transparent' }}
          />
          <View className="min-w-0 flex-1">
            <Text className="font-dm-bold text-label text-ink">{venue.name}</Text>
            <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">Official venue details</Text>
          </View>
          <ChevronRight color={colors.peach} strokeWidth={1.8} />
        </RaisedTouchable>
      ),
    });
  }

  return (
    <DetailScreen
      image={collection.coverImage}
      title={collection.title}
      meta={collection.eyebrow}
      lede={collection.description}
      sections={sections}
      // A shortlist is assembled from several official sources, so there is
      // no single site to hand off to — it says where instead of linking.
      // The expiry itself is not worth a sentence: activeCollectionItems has
      // already dropped anything past its day by the time this renders, so the
      // notice only ever described something the guest could not see.
      sourceNote={collection.sourceNote}
      navActive="discover"
    />
  );
}
