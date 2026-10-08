import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { EditorialNearestRow, editorialStyles } from '@/components/home-editorial';
import { Screen, ScreenScroll } from '@/components/layout';
import { useActiveCityName } from '@/lib/city';
import { useEditorial } from '@/lib/editorial';
import { useNearestPlaces } from '@/lib/use-nearest-places';
import { useScoper } from '@/lib/store';

/** Home's entire five-mile pool, in the same Editorial row style and order. */
export default function NearestScreen() {
  const router = useRouter();
  const { c, gutter } = useEditorial();
  const cityName = useActiveCityName();
  const phone = useScoper((state) => state.deviceLocation);
  const ranked = useNearestPlaces();
  return (
    <Screen backgroundColor={c.paper}>
      <ScreenScroll gap={0} contentStyle={{ maxWidth: 390, paddingHorizontal: gutter }}>
        <View style={editorialStyles.listHeader}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to Home" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} hitSlop={4} style={editorialStyles.back}><Glyph name="back" size={20} color={c.ink} /></TouchableOpacity>
          <Text accessibilityRole="header" style={[editorialStyles.listTitle, { color: c.ink }]}>{phone ? 'Nearest to you' : `Nearest in ${cityName}`}</Text>
        </View>
        <Text style={[editorialStyles.listCount, { color: c.ink }]}>{ranked.length} {ranked.length === 1 ? 'place' : 'places'} within 5 miles</Text>
        <Text style={[editorialStyles.listBlurb, { color: c.muted }]}>Within 5 miles of the {cityName} reference. Closest first, with straight-line distances {phone ? 'from your location' : 'from the downtown reference'}.</Text>
        {ranked.length ? ranked.map((entry, index) => <EditorialNearestRow key={entry.key} entry={entry} last={index === ranked.length - 1} onPress={() => router.push(entry.href)} />) : <Text style={[editorialStyles.status, { color: c.muted }]}>No nearby places loaded yet. Pull to refresh Home to load the local catalog. Location permission is optional.</Text>}
      </ScreenScroll>
    </Screen>
  );
}
