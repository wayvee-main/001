import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { HeaderRow, Screen, ScreenScroll } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedTouchable } from '@/components/raised-surface';
import { ChevronRight, EmptyState } from '@/components/ui';
import { CURATED_COLLECTION_ORDER, CURATED_COLLECTIONS, EVENTS, RESTAURANTS, activeCollectionItems } from '@/lib/data';
import { useScoper } from '@/lib/store';
import { collectionHaystack, sortByAffinity } from '@/lib/taste';
import { useThemeColors } from '@/lib/theme';

export default function CollectionsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const tasteTags = useScoper((s) => s.tasteTags);
  const collections = sortByAffinity(
    CURATED_COLLECTION_ORDER
      .map((id) => CURATED_COLLECTIONS[id])
      .filter((collection) => activeCollectionItems(collection).length > 0),
    tasteTags,
    collectionHaystack,
  );

  return (
    <Screen>
      <ScreenScroll gap={16}>
        <HeaderRow title="Collections" />
        <Text className="-mt-1 font-dm text-[13px] leading-[19px] text-taupe">
          Open a collection for the complete lineup, then continue to verified details.
        </Text>

        {collections.length > 0 ? (
          <View className="gap-y-3">
            {collections.map((collection) => {
              const items = activeCollectionItems(collection);
              const lead = items[0];
              const leadName = lead
                ? lead.type === 'restaurant'
                  ? RESTAURANTS[lead.id]?.name
                  : EVENTS[lead.id]?.name
                : undefined;
              const extra = items.length - (leadName ? 1 : 0);
              const tail = collection.subtitle.split(' · ').slice(-1)[0];
              const meta = leadName
                ? `${leadName}${extra > 0 ? ` +${extra} more` : ''} · ${tail}`
                : `${items.length} current ${items.length === 1 ? 'pick' : 'picks'} · ${tail}`;

              return (
                <RaisedTouchable
                  key={collection.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${collection.title}`}
                  activeOpacity={0.72}
                  onPress={() => router.push(`/collection/${collection.id}`)}
                  className="flex-row items-center gap-x-3.5 rounded-card p-3.5">
                  <Photo uri={collection.coverImage} radius={10} style={{ width: 64, height: 64 }} />
                  <View className="min-w-0 flex-1">
                    <View className="self-start rounded-full bg-blush px-2 py-[2px]">
                      <Text numberOfLines={1} className="font-dm-bold text-[9px] tracking-[0.6px] text-peach">
                        {collection.eyebrow}
                      </Text>
                    </View>
                    <Text numberOfLines={1} className="mt-1 font-fraunces text-[16px] text-ink">
                      {collection.title}
                    </Text>
                    <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">
                      {meta}
                    </Text>
                  </View>
                  <ChevronRight color={colors.taupe} />
                </RaisedTouchable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No active collections"
            message="Check back soon for new curated shortlists."
            actionLabel="Browse Discover"
            onAction={() => router.push('/discover')}
            tone="solid"
          />
        )}
      </ScreenScroll>
    </Screen>
  );
}

