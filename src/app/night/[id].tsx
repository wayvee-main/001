import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { DetailIconButton } from '@/components/detail';
import { DetailScreen, type DetailScreenAction } from '@/components/detail-screen';
import { Screen } from '@/components/layout';
import { BackButton } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { NIGHTLIFE_SPOTS } from '@/lib/data';
import { mapsDirectionsLink } from '@/lib/links';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

const MARTINI = 'M8 21h8 M12 15v6 M5 4h14l-7 8z';
const HEART = 'M20.84 4.61a5.5 5.5 0 0 0 -7.78 0l-1.06 1.06l-1.06 -1.06a5.5 5.5 0 0 0 -7.78 7.78l1.06 1.06l7.78 7.78l7.78 -7.78l1.06 -1.06a5.5 5.5 0 0 0 0 -7.78z';
const CHECK = 'M5 12l5 5l10 -10';

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return NIGHTLIFE_SPOTS.map((spot) => ({ id: spot.id }));
}

export default function NightSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { deviceLocation, isPlanned, isSaved, showToast, toggleSaved, togglePlan } = useScoper();
  const colors = useThemeColors();
  const spot = NIGHTLIFE_SPOTS.find((entry) => entry.id === id);

  if (!spot) {
    return (
      <Screen>
        <View className="mx-auto w-full max-w-[720px] flex-1 px-5">
          <BackButton />
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <Text className="font-fraunces text-display text-ink">Spot unavailable</Text>
            <Text className="mt-2 text-center font-dm text-body text-taupe">Browse Discover for current night-out spots.</Text>
            <TouchableOpacity onPress={() => router.replace('/discover')} className="mt-5 rounded-full bg-ember px-6 py-3">
              <Text className="font-dm-medium text-body text-white">Browse Discover</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    );
  }

  const openExternal = (url: string, errorMessage: string) => {
    Linking.openURL(url).catch(() => showToast(errorMessage));
  };
  const saved = isSaved('night', spot.id);
  const planned = isPlanned('night', spot.id);

  const actions: DetailScreenAction[] = [
    { label: 'Official page', iconD: MARTINI, onPress: () => openExternal(spot.url, `Could not open ${spot.name}`) },
    {
      label: 'Plan a night',
      iconD: ICON_PATHS.sparkles,
      onPress: () =>
        router.push(`/create?nightlifeId=${spot.id}&q=${encodeURIComponent(`Dinner then drinks at ${spot.name}`)}`),
    },
  ];

  return (
    <DetailScreen
      image={spot.image}
      heroActions={
        <>
          <DetailIconButton
            d={HEART}
            label={saved ? `Remove ${spot.name} from saved places` : `Save ${spot.name}`}
            active={saved}
            fill={saved ? colors.peach : 'none'}
            onPress={() => toggleSaved('night', spot.id, spot.name)}
          />
          <DetailIconButton
            d={CHECK}
            label={planned ? `Remove ${spot.name} from plans` : `Add ${spot.name} to plans`}
            active={planned}
            activeClassName="bg-sage"
            color={planned ? colors.pine : colors.peach}
            onPress={() => togglePlan('night', spot.id, spot.name)}
          />
        </>
      }
      title={spot.name}
      meta={spot.kind}
      address={spot.address}
      onAddress={() =>
        openExternal(mapsDirectionsLink(spot.address, deviceLocation ?? undefined), 'Could not open Maps')
      }
      // A nightlife spot carries prose hours and nothing machine-readable, so
      // there is no live line to draw — the hours are a fact, not a state.
      facts={spot.hours ? [{ glyph: 'clock', label: spot.hours }] : []}
      lede={spot.desc}
      sourceUrl={spot.url}
      sourceLabel="Official page"
      actions={actions}
      navActive="discover"
    />
  );
}
