import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Photo } from '@/components/photo';
import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { RaisedTouchable } from '@/components/raised-surface';
import { ChevronRight, EmptyState } from '@/components/ui';
import { NIGHTLIFE_SPOTS, RESTAURANTS, VENUES } from '@/lib/data';
import { placeMetaLine, useAllPlaces } from '@/lib/places';
import { useScoper } from '@/lib/store';
import type { SavedPlaceKind } from '@/lib/user-data';

interface SavedPlaceCard {
  kind: SavedPlaceKind;
  id: string;
  name: string;
  meta: string;
  image?: string;
}

const KIND_LABELS: Record<SavedPlaceKind, string> = {
  restaurant: 'Restaurants',
  venue: 'Venues',
  place: 'Places',
  night: 'Nightlife',
};

const KIND_ORDER: SavedPlaceKind[] = ['restaurant', 'venue', 'place', 'night'];

export default function SavedPlacesScreen() {
  const router = useRouter();
  const savedPlaceKeys = useScoper((state) => state.savedPlaceKeys);
  const toggleSaved = useScoper((state) => state.toggleSaved);
  const allPlaces = useAllPlaces();

  const cards = savedPlaceKeys.reduce<SavedPlaceCard[]>((result, key) => {
    const [kind, id] = key.split(':') as [SavedPlaceKind, string];
    if (kind === 'restaurant' && RESTAURANTS[id]) {
      const r = RESTAURANTS[id];
      result.push({ kind, id, name: r.name, meta: `${r.cuisine} · ${r.distanceLabel}`, image: r.image });
    } else if (kind === 'venue' && VENUES[id]) {
      const v = VENUES[id];
      result.push({ kind, id, name: v.name, meta: v.detailMeta, image: v.image });
    } else if (kind === 'place') {
      const p = allPlaces.find((entry) => entry.id === id);
      if (p) result.push({ kind, id, name: p.name, meta: placeMetaLine(p), image: p.image ?? undefined });
    } else if (kind === 'night') {
      const spot = NIGHTLIFE_SPOTS.find((entry) => entry.id === id);
      if (spot) result.push({ kind, id, name: spot.name, meta: spot.kind, image: spot.image });
    }
    return result;
  }, []);

  const groups = KIND_ORDER
    .map((kind) => ({ kind, items: cards.filter((card) => card.kind === kind) }))
    .filter((group) => group.items.length > 0);

  const detailRoute = (kind: SavedPlaceKind) => (kind === 'night' ? 'night' : kind);

  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title="Saved places" />
        <Text className="-mt-1 font-dm text-[13px] leading-[19px] text-taupe">
          Your shortlist stays synced to your Wayvee account.
        </Text>

        {groups.length > 0 ? (
          <View className="gap-y-6">
            {groups.map((group) => (
              <View key={group.kind} className="gap-y-2.5">
                <Text className="font-dm-bold text-[13px] text-taupe">{KIND_LABELS[group.kind]} · {group.items.length}</Text>
                <View className="gap-y-3">
                  {group.items.map((place) => (
                    <RaisedTouchable
                      key={`${place.kind}:${place.id}`}
                      activeOpacity={0.72}
                      onPress={() => router.push(`/${detailRoute(place.kind)}/${place.id}`)}
                      className="overflow-hidden rounded-card">
                      <Photo uri={place.image} radius={0} style={{ width: '100%', height: 132 }} />
                      <View className="flex-row items-center gap-x-3 px-3.5 py-3.5">
                        <View className="min-w-0 flex-1">
                          <Text className="font-dm-bold text-[15px] text-ink">{place.name}</Text>
                          <Text numberOfLines={1} className="mt-0.5 font-dm text-label text-taupe">{place.meta}</Text>
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${place.name} from saved places`}
                          activeOpacity={0.7}
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleSaved(place.kind, place.id, place.name);
                          }}
                          className="rounded-full bg-blush px-3 py-2">
                          <Text className="font-dm-medium text-meta text-peach">Remove</Text>
                        </TouchableOpacity>
                        <ChevronRight />
                      </View>
                    </RaisedTouchable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="Build your Oakland shortlist"
            message="Save a restaurant, venue, place, or bar from its detail page and it will appear here."
            actionLabel="Explore places"
            onAction={() => router.push('/featured')}
            tone="solid"
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}
