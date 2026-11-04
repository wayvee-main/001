import { useRouter } from 'expo-router';
import { Text, View, useWindowDimensions } from 'react-native';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { CardMetadata } from '@/components/card-metadata';
import { Glyph } from '@/components/glyph';
import { PerksPhoto } from '@/components/local-perks';
import { cardMetadata } from '@/lib/card-metadata';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { useElevation } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { useWeatherNow, weatherLine } from '@/lib/weather';

export type DaybreakPeriod = 'day' | 'evening';

export function DaybreakIntro({ city }: { city: string }) {
  const colors = useThemeColors(), { width } = useWindowDimensions(), weather = useWeatherNow();
  const openStay = useScoper(s => s.openStaySheet);
  return <View testID="daybreak-intro" style={{ gap: 13 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Your starting point. ${city}`} onPress={openStay} hitSlop={8}>
        <Text numberOfLines={1} className="font-dm-medium text-taupe" style={{ fontSize: 11, lineHeight: 16, letterSpacing: .8, textTransform: 'uppercase' }}>{city} / A day well spent</Text>
      </Pressable>
      {weather ? <Text testID="home-weather" numberOfLines={1} className="font-dm text-taupe" style={{ fontSize: 11, lineHeight: 16 }}>{weatherLine(weather)}</Text> : null}
    </View>
    <View style={{ position: 'relative', paddingRight: 24 }}>
      <Text accessibilityRole="header" className="font-dm-medium text-ink" style={{ fontSize: width <= 360 ? 32 : 36, lineHeight: width <= 360 ? 34 : 37, letterSpacing: -1.2 }}>Go on.{'\n'}Make a day of it<Text style={{ color: colors['fg-accent'] }}>.</Text></Text>
      <View accessible={false} style={{ position: 'absolute', right: 0, bottom: 5, transform: [{ rotate: '12deg' }] }}><Glyph name="sun" size={width <= 360 ? 32 : 40} strokeWidth={1.3} color={colors['fg-accent']} /></View>
    </View>
  </View>;
}

export function DaybreakPeriodPicker({ value, onChange }: { value: DaybreakPeriod; onChange: (period: DaybreakPeriod) => void }) {
  const colors = useThemeColors();
  return <View testID="daybreak-periods" accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: colors['edge-soft'] }}>
    {([{ key: 'day', label: 'By day', glyph: 'sun' }, { key: 'evening', label: 'After hours', glyph: 'moon' }] as const).map(item => <Pressable key={item.key}
      testID={`daybreak-period-${item.key}`} accessibilityRole="tab" accessibilityState={{ selected: item.key === value }} onPress={() => onChange(item.key)}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottomWidth: 2,
        borderBottomColor: item.key === value ? colors['accent-fill'] : 'transparent', opacity: pressed ? .7 : 1 })}>
      <Glyph name={item.glyph} size={15} color={item.key === value ? colors['fg-accent'] : colors['fg-muted']} />
      <Text className="font-dm" style={{ fontSize: 12, lineHeight: 18, color: item.key === value ? colors['fg-accent'] : colors['fg-muted'] }}>{item.label}</Text>
    </Pressable>)}
  </View>;
}

/** The approved compact poster uses real source facts, never fixture metadata. */
export function DaybreakPoster({ entry, catalog, now }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date }) {
  const colors = useThemeColors(), elevation = useElevation(1), router = useRouter(), { width } = useWindowDimensions();
  const imageSize = width <= 360 ? 84 : 90, metadata = cardMetadata(entry, now, 3);
  const name = entry.name.trim().split(/\s+/).length > 5 ? entry.name.trim().split(/\s+/).slice(0, 5).join(' ') + '…' : entry.name;
  const category = (entry.category?.replace(/_/g, ' ') || entry.caption.split(' · ')[0]).trim();
  const description = entry.detailContent?.description || entry.description || entry.caption;
  return <Pressable testID="daybreak-poster" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${entry.description}`} onPress={() => router.push(homeGuideHref(entry) as never)}
    style={({ pressed }) => [elevation, { padding: 10, gap: 8, borderRadius: 19, borderWidth: 1, borderColor: colors['poster-edge'], backgroundColor: colors['surface-poster'], opacity: pressed ? .78 : 1 }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: width <= 360 ? 9 : 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        {category ? <Text numberOfLines={1} className="font-dm-medium text-taupe" style={{ fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' }}>{category}</Text> : null}
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm-medium text-ink" style={{ fontSize: width <= 360 ? 25 : 26, lineHeight: 30, letterSpacing: -.8 }}>{name}</Text>
        <Text numberOfLines={2} className="font-dm text-taupe" style={{ fontSize: width <= 360 ? 11 : 12, lineHeight: 18 }}>{description}</Text>
      </View>
      <View testID="daybreak-poster-photo"><PerksPhoto entry={entry} catalog={catalog} width={imageSize} height={imageSize} radius={12} /></View>
    </View>
    <CardMetadata items={metadata.items} />
  </Pressable>;
}
