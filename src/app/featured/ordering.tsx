import { useRouter } from 'expo-router';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { CompactPromo } from '@/components/compact-promo';
import { HeaderRow, Screen } from '@/components/layout';
import { Photo } from '@/components/photo';
import { ChevronRight, MiniChevron } from '@/components/ui';
import { FAV_POOL, RESTAURANTS, restaurantMetaLine } from '@/lib/data';
import { promotionForPlacement } from '@/lib/promotions';
import { useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

export default function FeaturedOrderingScreen() {
  const router = useRouter();
  const showToast = useScoper((state) => state.showToast);
  const colors = useThemeColors();
  const surface = useRaisedSurface(2);
  const restaurants = FAV_POOL.map((id) => RESTAURANTS[id]).filter((restaurant) => restaurant?.primaryAction?.url);
  const savingsPromotion = promotionForPlacement('ordering-savings');

  const openOfficialAction = (name: string, url: string) => {
    Linking.openURL(url).catch(() => showToast(`Could not open ${name}'s official page`));
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 30, gap: 18 }}>
        <HeaderRow title="Menus and ordering" />

        <View className="rounded-card border border-sand bg-coral-50 p-4">
          <Text className="font-dm-bold text-[9.5px] tracking-[0.8px] text-peach">OFFICIAL HANDOFFS</Text>
          <Text className="mt-2 font-fraunces text-[22px] leading-[26px] text-ink">Start with the restaurant, not a mystery listing</Text>
          <Text className="mt-2 font-dm text-[12.5px] leading-[18px] text-taupe">
            Review the spot first or continue directly to its verified menu, pickup, or ordering page.
          </Text>
        </View>

        {savingsPromotion ? <CompactPromo promotion={savingsPromotion} /> : null}

        <View>
          <Text className="font-fraunces text-[20px] text-ink">Choose a spot</Text>
          <View className="mt-3 gap-y-2.5">
            {restaurants.map((restaurant) => (
              <View
                key={restaurant.id}
                style={surface}
                className="overflow-hidden rounded-card p-3">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${restaurant.name}`}
                  activeOpacity={0.72}
                  onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                  className="flex-row items-center gap-x-3">
                  <View className="rounded-card border border-sand bg-shell p-1">
                    <Photo uri={restaurant.image} radius={8} style={{ width: 62, height: 62 }} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm-bold text-[14.5px] text-ink">{restaurant.name}</Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" className="mt-1 font-dm text-meta text-taupe">
                      {restaurantMetaLine(restaurant)}
                    </Text>
                    <Text numberOfLines={1} ellipsizeMode="tail" className="mt-1 font-dm-medium text-meta text-pine">
                      {restaurant.primaryAction.label === 'Menu'
                        ? 'Current official menu'
                        : restaurant.primaryAction.label === 'Official site'
                          ? 'Official restaurant page'
                          : `${restaurant.readyEstimate} readiness estimate`}
                    </Text>
                  </View>
                  <ChevronRight color={colors.peach} strokeWidth={1.8} />
                </TouchableOpacity>

                <View className="mt-2.5 flex-row gap-x-2">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push(`/restaurant/${restaurant.id}`)}
                    className="flex-1 items-center rounded-full border border-sand bg-shell py-2">
                    <Text className="font-dm-medium text-label text-ink">Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="link"
                    accessibilityLabel={`${restaurant.primaryAction.label} from ${restaurant.name}`}
                    activeOpacity={0.7}
                    onPress={() => openOfficialAction(restaurant.name, restaurant.primaryAction.url)}
                    className="flex-1 flex-row items-center justify-center gap-x-1.5 rounded-full border border-sand bg-coral-50 py-2">
                    <Text className="font-dm-medium text-label text-peach">{restaurant.primaryAction.label}</Text>
                    <MiniChevron />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>

        <Text className="text-center font-dm text-[10.5px] leading-[15px] text-taupe">
          Readiness is a planning estimate · final availability and fees appear on the restaurant or provider page
        </Text>
      </ScrollView>
    </Screen>
  );
}
