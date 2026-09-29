import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  DetailScreen,
  whyRow,
  type DetailDisclosure,
  type DetailScreenAction,
} from '@/components/detail-screen';
import { DetailFactList, DetailIconButton } from '@/components/detail';
import { Screen } from '@/components/layout';
import { Photo } from '@/components/photo';
import { RaisedView } from '@/components/raised-surface';
import { BackButton, ChevronRight } from '@/components/ui';
import { WeekHoursStrip } from '@/components/visual-depictions';
import { useNow } from '@/lib/clock';
import { ICON_PATHS } from '@/lib/icons';
import { RESTAURANTS, menuItemImage } from '@/lib/data';
import { durationFrom, liveLineFor, restaurantFacts } from '@/lib/detail-facts';
import { milesBetween, usableAnchor, walkMinutes } from '@/lib/geo';
import { hoursSummary, openStateFor } from '@/lib/hours';
import { mapsDirectionsLink } from '@/lib/links';
import { useCuratedCoords, useCuratedHours } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { profileAffinity, restaurantHaystack } from '@/lib/taste';
import { useTasteProfile } from '@/lib/use-taste-profile';
import { useThemeColors } from '@/lib/theme';

const CUTLERY = 'M7 3v6a3 3 0 0 0 6 0v-6 M10 3v18 M18 3v18 M18 3c-3 2 -3 8 0 10';
const COURIER = 'M5 16m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M19 16m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M7 16h8l2.5 -7.5h3.5 M13 8.5h3';
const PHONE = 'M5 4h4l2 5l-3 2a11 11 0 0 0 5 5l2-3l5 2v4a2 2 0 0 1 -2 2c-8.3 0 -15 -6.7 -15 -15a2 2 0 0 1 2 -2';
const HEART = 'M20.84 4.61a5.5 5.5 0 0 0 -7.78 0l-1.06 1.06l-1.06 -1.06a5.5 5.5 0 0 0 -7.78 7.78l1.06 1.06l7.78 7.78l7.78 -7.78l1.06 -1.06a5.5 5.5 0 0 0 0 -7.78z';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return Object.keys(RESTAURANTS).map((id) => ({ id }));
}

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceLocation, isSaved, showToast, toggleSaved, walkBudgetMinutes } = useScoper();
  const colors = useThemeColors();
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const profile = useTasteProfile();
  const now = useNow();
  const restaurant = RESTAURANTS[id ?? ''];

  // The only machine-readable hours a curated restaurant has: the OSM tag
  // carried into public.places by the daily sync. Unreadable or absent hours
  // stay unknown — the catalog's own hours line keeps doing the talking.
  const hoursSpec = restaurant ? curatedHours(restaurant) : null;
  const openState = openStateFor(hoursSpec, now);
  const point = restaurant ? curatedCoords(restaurant) : null;
  const anchor = usableAnchor(deviceLocation);
  const walkFromYou = anchor && point ? walkMinutes(milesBetween(anchor, point)) : null;

  const affinity = useMemo(() => {
    if (!restaurant) return null;
    return profileAffinity(restaurantHaystack(restaurant), profile, {
      walkMinutes: walkFromYou,
      walkBudgetMinutes,
      budgetLabel: restaurant.price,
      openLabel: openState.status === 'open' ? (openState.closesAt ? `Open till ${openState.closesAt}` : 'Open now') : null,
      closedLabel: openState.status === 'closed' ? (openState.opensAt ? `Closed · opens ${openState.opensAt}` : 'Closed now') : null,
    });
    // openState is derived from hoursSpec and the current minute; keying on the
    // parts keeps this from rebuilding on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant, profile, walkFromYou, walkBudgetMinutes, hoursSpec, openState.status]);

  if (!restaurant) {
    return (
      <Screen>
        <View className="mx-auto w-full max-w-[720px] flex-1 px-5">
          <BackButton />
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <Text className="font-fraunces text-display text-ink">Restaurant unavailable</Text>
            <Text className="mt-2 text-center font-dm text-body text-taupe">Browse the current food directory instead.</Text>
            <TouchableOpacity onPress={() => router.replace('/featured')} className="mt-5 rounded-full bg-ember px-6 py-3">
              <Text className="font-dm-medium text-body text-white">Browse food</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  const openExternal = (url: string, errorMessage: string) => {
    Linking.openURL(url).catch(() => showToast(errorMessage));
  };
  const saved = isSaved('restaurant', restaurant.id);
  const phone = restaurant.detailFacts.find((fact) => fact.label === 'Phone')?.value;
  // Phone is the hero's call button, and Hours is the row below — a fact list
  // that repeats both is how the old About tab ended up saying the opening
  // time for the third time on one screen.
  const hasHoursRow = Boolean(hoursSpec) || Boolean(restaurant.hours);
  const planningFacts = restaurant.detailFacts.filter(
    (fact) => fact.label !== 'Phone' && !(hasHoursRow && fact.label === 'Hours'),
  );

  // One external handoff, then the planner. The sticky bar is the only place
  // actions live now — the inline "Plan a night here" button that used to sit
  // under the address was the same tap, 500 px higher up.
  const externalLabel = restaurant.reserveUrl ? 'Reserve' : restaurant.primaryAction.label;
  const externalUrl = restaurant.reserveUrl ?? restaurant.primaryAction.url;
  const externalIcon = ['Menu', 'Official site'].includes(restaurant.primaryAction.label) ? CUTLERY : COURIER;
  const actions: DetailScreenAction[] = [
    {
      label: externalLabel,
      iconD: restaurant.reserveUrl ? CUTLERY : externalIcon,
      onPress: () => openExternal(externalUrl, `Could not open ${externalLabel.toLowerCase()}`),
    },
    {
      label: 'Plan a night',
      iconD: ICON_PATHS.sparkles,
      onPress: () =>
        router.push(`/create?restaurantId=${restaurant.id}&q=${encodeURIComponent(`Night out starting at ${restaurant.name}`)}`),
    },
  ];

  // The sticky button already opens the official menu for a place with no
  // reservations, so the row does not offer the same link a second time.
  const stickyOpensMenu = !restaurant.reserveUrl && restaurant.primaryAction.url === restaurant.menuUrl;

  // Not restaurantMetaLine(): that one is "Thai · $$ · 0.7 mi", and on this
  // screen the price now lives in the fact strip and the distance in the live
  // line. What is left for the line under the name is the only thing neither
  // of them says — what kind of place this is.
  const kindLine = [restaurant.cuisine, restaurant.hasDelivery ? 'Delivery' : null].filter(Boolean).join(' · ');
  const weekNote = hoursSummary(hoursSpec) ?? restaurant.hours ?? undefined;

  const rows: DetailDisclosure[] = [
    ...(restaurant.menuHighlights.length
      ? [{
          key: 'menu',
          glyph: 'food',
          label: 'Menu',
          summary: stickyOpensMenu
            ? `${restaurant.menuHighlights.length} highlights`
            : `${restaurant.menuHighlights.length} highlights · full menu on their site`,
          children: (
            <View className="gap-y-2">
              {restaurant.menuHighlights.map((item) => (
                <View key={item.name} className="flex-row items-center gap-x-3">
                  <Photo uri={menuItemImage(item)} radius={9} style={{ width: 40, height: 40 }} />
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-dm-medium text-label text-ink">{item.name}</Text>
                    {item.desc ? (
                      <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{item.desc}</Text>
                    ) : null}
                  </View>
                  {item.price ? <Text className="font-dm-bold text-meta text-pine">{item.price}</Text> : null}
                </View>
              ))}
              {stickyOpensMenu ? null : (
                <TouchableOpacity
                  accessibilityRole="link"
                  activeOpacity={0.7}
                  onPress={() => openExternal(restaurant.menuUrl, 'Could not open the official menu')}
                  className="mt-1 flex-row items-center gap-x-1">
                  <Text className="font-dm-medium text-meta text-peach">Full menu</Text>
                  <ChevronRight color={colors.peach} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
            </View>
          ),
        }]
      : []),
    ...(hasHoursRow
      ? [{
          key: 'hours',
          glyph: 'clock',
          label: 'Hours this week',
          summary: weekNote,
          children: hoursSpec ? (
            <WeekHoursStrip spec={hoursSpec} now={now} note={weekNote} />
          ) : (
            <RaisedView className="rounded-card px-4 py-3.5">
              <Text className="font-dm text-label leading-[18px] text-ink">{restaurant.hours}</Text>
              <Text className="mt-1.5 font-dm text-micro text-taupe">
                As published by {restaurant.name}. No machine-readable hours are synced for this kitchen yet.
              </Text>
            </RaisedView>
          ),
        }]
      : []),
    ...(planningFacts.length
      ? [{
          key: 'know',
          glyph: 'bolt',
          label: 'Good to know',
          summary: planningFacts.map((fact) => fact.label).join(' · '),
          children: <DetailFactList facts={planningFacts} />,
        }]
      : []),
    ...whyRow(restaurant.name, affinity),
  ];

  return (
    <DetailScreen
      image={restaurant.image}
      heroActions={
        <>
          <DetailIconButton
            d={HEART}
            label={saved ? `Remove ${restaurant.name} from saved places` : `Save ${restaurant.name}`}
            active={saved}
            fill={saved ? colors.peach : 'none'}
            onPress={() => toggleSaved('restaurant', restaurant.id, restaurant.name)}
          />
          {phone ? (
            <DetailIconButton
              d={PHONE}
              label={`Call ${restaurant.name}`}
              onPress={() => openExternal(`tel:${phone.replace(/\D/g, '')}`, 'Could not start the call')}
            />
          ) : null}
        </>
      }
      title={restaurant.name}
      rating={restaurant.rating}
      meta={kindLine || undefined}
      address={restaurant.address}
      onAddress={() =>
        openExternal(mapsDirectionsLink(restaurant.address, deviceLocation ?? undefined), 'Could not open Maps')
      }
      live={liveLineFor({ openState, walkMinutes: walkFromYou, walkBudgetMinutes })}
      facts={restaurantFacts({
        price: restaurant.price,
        reservable: Boolean(restaurant.reserveUrl),
        duration: durationFrom(restaurant.detailFacts),
        distance: walkFromYou == null ? restaurant.distanceLabel : null,
      })}
      rows={rows}
      sourceUrl={restaurant.sourceUrl}
      sourceLabel="Official site"
      actions={actions}
      navActive="home"
    />
  );
}
