import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { DetailBottomNav } from '@/components/bottom-nav';
import { DetailFactList, DetailIconButton, DetailSheet, ImmersiveDetailHero, SourceLink } from '@/components/detail';
import { AppBackdrop, Screen } from '@/components/layout';
import { BackButton, Icon } from '@/components/ui';
import { formatMiles, milesBetween, usableAnchor } from '@/lib/geo';
import { hoursSummary, openStateFor, openStateLabel } from '@/lib/hours';
import { mapsDirectionsLink } from '@/lib/links';
import { placeCategoryLabel, placeMetaLine, useAllPlaces } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

const PIN = 'M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z';
const ROUTE = 'M5 19a2 2 0 1 0 0 -4a2 2 0 1 0 0 4 M19 9a2 2 0 1 0 0 -4a2 2 0 1 0 0 4 M7 17c5 0 5 -10 10 -10';
const PHONE = 'M5 4h4l2 5l-3 2a11 11 0 0 0 5 5l2-3l5 2v4a2 2 0 0 1 -2 2c-8.3 0 -15 -6.7 -15 -15a2 2 0 0 1 2 -2';
const HEART = 'M20.84 4.61a5.5 5.5 0 0 0 -7.78 0l-1.06 1.06l-1.06 -1.06a5.5 5.5 0 0 0 -7.78 7.78l1.06 1.06l7.78 7.78l7.78 -7.78l1.06 -1.06a5.5 5.5 0 0 0 0 -7.78z';

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceLocation, isSaved, showToast, toggleSaved } = useScoper();
  const places = useAllPlaces();
  const place = places.find((p) => p.id === id);
  const colors = useThemeColors();

  if (!place) {
    return (
      <Screen>
        <View className="mx-auto w-full max-w-[720px] flex-1 px-5">
          <BackButton />
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <Text className="font-fraunces text-[25px] text-ink">Place unavailable</Text>
            <Text className="mt-2 text-center font-dm text-[13.5px] leading-5 text-taupe">Browse the Oakland food hub instead.</Text>
            <TouchableOpacity onPress={() => router.replace('/featured')} className="mt-5 rounded-full bg-ember px-6 py-3">
              <Text className="font-dm-medium text-[14px] text-white">Open food hub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  const openExternal = (url: string, errorMessage: string) => {
    Linking.openURL(url).catch(() => showToast(errorMessage));
  };
  const directionsUrl = mapsDirectionsLink(`${place.lat},${place.lon}`, deviceLocation ?? undefined);
  const anchor = usableAnchor(deviceLocation);
  const distanceMiles = anchor ? milesBetween(anchor, { latitude: place.lat, longitude: place.lon }) : null;
  const saved = isSaved('place', place.id);

  // Computed from the place's own OpenStreetMap hours string. Unparseable or
  // missing hours produce no row at all — the app never guesses a schedule,
  // and "no line" is the honest answer (see lib/hours.ts).
  const openLabel = openStateLabel(openStateFor(place.openingHours));
  // Readable rendering when the syntax parses; the source string verbatim when
  // it doesn't, so a guest still sees what OpenStreetMap actually says.
  const hoursLabel = place.openingHours ? (hoursSummary(place.openingHours) ?? place.openingHours) : null;

  const facts = [
    { label: 'Type', value: placeCategoryLabel(place) },
    ...(openLabel ? [{ label: 'Right now', value: openLabel }] : []),
    ...(hoursLabel ? [{ label: 'Hours', value: hoursLabel }] : []),
    ...(distanceMiles != null ? [{ label: 'Distance', value: `${formatMiles(distanceMiles)} from you` }] : []),
    ...(place.address ? [{ label: 'Address', value: place.address }] : []),
    {
      label: 'Source',
      value: place.confidence === 'cross_confirmed'
        ? 'Cross-checked, Overture Maps + OpenStreetMap'
        : place.confidence === 'overture_only'
          ? 'Overture Maps'
          : 'OpenStreetMap',
    },
  ];

  return (
    <AppBackdrop>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <ImmersiveDetailHero
          image={place.image ?? undefined}
          actions={
            <DetailIconButton
              d={HEART}
              label={saved ? `Remove ${place.name} from saved places` : `Save ${place.name}`}
              active={saved}
              fill={saved ? colors.peach : 'none'}
              onPress={() => toggleSaved('place', place.id, place.name)}
            />
          }
        />

        <DetailSheet>
          <View className="gap-y-2">
            <Text className="font-fraunces text-[22px] leading-[26px] text-ink">{place.name}</Text>
            <Text numberOfLines={1} className="font-dm text-label text-taupe">{placeMetaLine(place)}</Text>
            {place.address ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Directions to ${place.address}`}
                activeOpacity={0.7}
                onPress={() => openExternal(directionsUrl, 'Could not open Maps')}
                className="flex-row items-center gap-x-1.5">
                <Icon d={PIN} size={13} color={colors.peach} strokeWidth={1.8} />
                <Text numberOfLines={1} className="min-w-0 flex-1 font-dm text-label text-ink">{place.address}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View className="gap-y-3">
            <DetailFactList facts={facts} />
            {place.phone ? (
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.72}
                onPress={() => openExternal(`tel:${place.phone!.replace(/\D/g, '')}`, 'Could not start the call')}
                className="flex-row items-center gap-x-2 rounded-card border border-sand bg-shell px-4 py-3 shadow-2xs">
                <Icon d={PHONE} size={15} color={colors.peach} strokeWidth={1.8} />
                <Text className="font-dm-medium text-[13px] text-ink">{place.phone}</Text>
              </TouchableOpacity>
            ) : null}
            <SourceLink url={place.website ?? undefined} label="Visit website" />
          </View>
        </DetailSheet>
      </ScrollView>

      <View className="border-t border-sand bg-cream px-5 py-3">
        <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={() => openExternal(directionsUrl, 'Could not open Maps')}
            className="h-12 flex-row items-center justify-center gap-x-1.5 rounded-full bg-ember">
            <Icon d={ROUTE} size={15} color="#FFFFFF" strokeWidth={1.9} />
            <Text className="font-dm-medium text-[13px] text-white">Get directions</Text>
          </TouchableOpacity>
        </View>
      </View>
      <DetailBottomNav active="discover" />
    </AppBackdrop>
  );
}
