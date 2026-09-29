import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Photo } from '@/components/photo';
import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { RaisedTouchable } from '@/components/raised-surface';
import { ChevronRight, EmptyState } from '@/components/ui';
import { VENUES } from '@/lib/data';
import { useScoper } from '@/lib/store';

export default function FollowingScreen() {
  const router = useRouter();
  const followedVenues = useScoper((state) => state.followedVenues);
  const toggleFollow = useScoper((state) => state.toggleFollow);

  const venues = followedVenues
    .map((id) => VENUES[id])
    .filter((venue): venue is NonNullable<typeof venue> => Boolean(venue));

  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title="Following" />
        <Text className="-mt-1 font-dm text-[13px] leading-[19px] text-taupe">
          Venues you follow stay synced to your Wayvee account.
        </Text>

        {venues.length > 0 ? (
          <View className="gap-y-3">
            {venues.map((venue) => (
              <RaisedTouchable
                key={venue.id}
                activeOpacity={0.72}
                onPress={() => router.push(`/venue/${venue.id}`)}
                className="overflow-hidden rounded-card">
                <Photo uri={venue.image} radius={0} style={{ width: '100%', height: 132 }} />
                <View className="flex-row items-center gap-x-3 px-3.5 py-3.5">
                  <View className="min-w-0 flex-1">
                    <Text className="font-dm-bold text-[15px] text-ink">{venue.name}</Text>
                    <Text numberOfLines={1} className="mt-0.5 font-dm text-label text-taupe">{venue.detailMeta}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Unfollow ${venue.name}`}
                    activeOpacity={0.7}
                    onPress={(event) => {
                      event.stopPropagation();
                      toggleFollow(venue.id, venue.name);
                    }}
                    className="rounded-full bg-blush px-3 py-2">
                    <Text className="font-dm-medium text-meta text-peach">Unfollow</Text>
                  </TouchableOpacity>
                  <ChevronRight />
                </View>
              </RaisedTouchable>
            ))}
          </View>
        ) : (
          <EmptyState
            title="Follow your favorite venues"
            message="Follow a venue from its detail page and it will appear here."
            actionLabel="Browse Discover"
            onAction={() => router.push('/discover')}
            tone="solid"
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}
