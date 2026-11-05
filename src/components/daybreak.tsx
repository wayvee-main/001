import { Text, View, useWindowDimensions } from 'react-native';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { AuroraPoster, GradientFill, GradientText, useGlass } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { useAurora } from '@/lib/aurora';
import type { HomeGuideCatalog, HomeGuideEntry } from '@/lib/home-guide';
import { useThemeColors } from '@/lib/theme';
import { useWeatherNow, weatherLine } from '@/lib/weather';

export type DaybreakPeriod = 'day' | 'evening';

/** Home's intro: the current-hour weather in a frosted pill (omitted when there's
 * no forecast) and the headline, its second line in the Aurora gradient. */
export function DaybreakIntro({ city }: { city: string }) {
  const colors = useThemeColors(), glass = useGlass(), { width } = useWindowDimensions(), weather = useWeatherNow();
  const narrow = width <= 360;
  return <View testID="daybreak-intro" style={{ gap: 12 }}>
    {weather ? <View testID="home-weather" accessible accessibilityLabel={`${city} weather. ${weatherLine(weather)}`}
      style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingLeft: 10, paddingRight: 12, borderRadius: 15, ...glass }}>
      <Glyph name="cloud" size={15} color={colors['fg-muted']} strokeWidth={1.7} />
      <Text numberOfLines={1} className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{weatherLine(weather)}</Text>
    </View> : null}
    <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: narrow ? 32 : 36, lineHeight: narrow ? 36 : 40, letterSpacing: -1.3 }}>
      Go on.{'\n'}<GradientText text="Make a day of it." />
    </Text>
  </View>;
}

/** By day / After hours as a two-pill toggle: the selected one filled with the Aurora gradient. */
export function DaybreakPeriodPicker({ value, onChange }: { value: DaybreakPeriod; onChange: (period: DaybreakPeriod) => void }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <View testID="daybreak-periods" accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
    {([{ key: 'day', label: 'By day', glyph: 'sun' }, { key: 'evening', label: 'After hours', glyph: 'moon' }] as const).map(item => {
      const selected = item.key === value;
      return <Pressable key={item.key} testID={`daybreak-period-${item.key}`} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} onPress={() => onChange(item.key)} hitSlop={{ top: 4, bottom: 4 }}
        style={({ pressed }) => ({ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, borderRadius: 999,
          overflow: 'hidden', borderWidth: selected ? 0 : 1, borderColor: aurora.glassEdge, backgroundColor: selected ? undefined : colors['surface-raised'], opacity: pressed ? .7 : 1 })}>
        {selected ? <GradientFill /> : null}
        <View><Glyph name={item.glyph} size={16} color={selected ? aurora.onFill : colors['fg-muted']} strokeWidth={1.7} /></View>
        <Text className="font-dm-medium" style={{ fontSize: 14, lineHeight: 19, color: selected ? aurora.onFill : colors['fg-muted'] }}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const FEATURE_CHIPS: Partial<Record<HomeGuideEntry['kind'], { label: string; glyph: string }>> = {
  event: { label: 'On stage', glyph: 'ticket' },
  restaurant: { label: 'A good table', glyph: 'food' },
  night: { label: 'After dinner', glyph: 'drink' },
  crawl: { label: 'A little wandering', glyph: 'route' },
  venue: { label: 'Rooms worth knowing', glyph: 'landmark' },
};

/** Home's featured pick as the split-card poster, labelled by what kind of pick it is. */
export function DaybreakFeature({ entry, catalog, now }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date }) {
  return <AuroraPoster testID="daybreak-poster" entry={entry} catalog={catalog} now={now} chip={FEATURE_CHIPS[entry.kind]} photoHeight={136} />;
}
