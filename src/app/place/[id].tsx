import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailFactList } from '@/components/detail';
import { DetailScreen } from '@/components/detail-screen';
import { Screen, useAppGutter } from '@/components/layout';
import { BackButton } from '@/components/ui';
import { formatMiles, milesBetween, usableAnchor } from '@/lib/geo';
import { hoursSummary, openStateFor, openStateLabel } from '@/lib/hours';
import { mapsDirectionsLink } from '@/lib/links';
import { placeCategoryLabel, useAllPlaces } from '@/lib/places';
import { useScoper } from '@/lib/store';

const PHONE = 'M5 4h4l2 5l-3 2a11 11 0 0 0 5 5l2-3l5 2v4a2 2 0 0 1 -2 2c-8.3 0 -15 -6.7 -15 -15a2 2 0 0 1 2 -2';

export default function PlaceScreen() {
  const gutter = useAppGutter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceLocation, showToast } = useScoper();
  const places = useAllPlaces();
  const place = places.find((p) => p.id === id);

  if (!place) {
    return (
      <Screen>
        <View style={{ paddingHorizontal: gutter }} className="mx-auto w-full max-w-[720px] flex-1">
          <BackButton />
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <Text className="font-fraunces text-[25px] text-ink">Place unavailable</Text>
            <Text className="mt-2 text-center font-dm text-[13.5px] leading-5 text-taupe">Browse the Oakland food hub instead.</Text>
            <TouchableOpacity onPress={() => router.replace('/featured')} className="mt-5 rounded-full bg-ember px-6 py-3 border border-edge-card border-b-edge-card-bottom shadow-soft-light dark:shadow-soft-dark">
              <Text className="font-dm-medium text-[14px] text-on-accent">Open food hub</Text>
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

  return <DetailScreen
    image={place.image ?? undefined}
    title={place.name}
    meta={placeCategoryLabel(place)}
    address={place.address ?? undefined}
    onAddress={() => openExternal(directionsUrl, 'Could not open Maps')}
    facts={[
      ...(distanceMiles != null ? [{glyph:'pin',label:formatMiles(distanceMiles)}] : []),
      ...(hoursLabel ? [{glyph:'clock',label:hoursLabel}] : []),
    ]}
    rows={[{key:'details',glyph:'compass',label:'More details',children:<DetailFactList facts={facts} />}]}
    sourceUrl={place.website ?? undefined}
    sourceLabel="Visit website"
    actions={place.phone ? [{label:'Call',iconD:PHONE,onPress:() => openExternal(`tel:${place.phone!.replace(/\D/g, '')}`, 'Could not start the call')}] : []}
    navActive="discover"
  />;
}
