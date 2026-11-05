import { useRouter } from 'expo-router';
import { Text, View, useWindowDimensions } from 'react-native';
import { GradientFill } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';
import { headingStyle } from '@/lib/typography';

/** Home's quiet pieces: section headings and the thin perks and Vee ribbons. */
export function QuietHomeHeading({ title, onMore }: { title: string; onMore?: () => void }) {
  const colors = useThemeColors(), { width } = useWindowDimensions();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
    <Text accessibilityRole="header" className="text-ink" style={{ flexShrink: 1, ...headingStyle(width <= 360 ? 21 : 23) }}>{title}</Text>
    {onMore ? <Pressable accessibilityRole="button" accessibilityLabel={`More ${title.toLowerCase()}`} onPress={onMore} hitSlop={7}
      style={({ pressed }) => ({ minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? .7 : 1 })}>
      <Text className="font-dm" style={{ fontSize: 12, lineHeight: 18, color: colors['fg-accent'] }}>More</Text><Glyph name="chevron" size={13} color={colors['fg-accent']} />
    </Pressable> : null}
  </View>;
}

export function QuietHomeOffers() {
  const colors = useThemeColors(), router = useRouter();
  return <Pressable testID="quiet-home-offers" accessibilityRole="button" accessibilityLabel="Local perks. View offers near you" onPress={() => router.push('/offers')}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 9, opacity: pressed ? .8 : 1 })}>
    <GradientFill radius={13} soft />
    <Glyph name="tag" size={16} color={colors['fg-accent']} />
    <Text className="font-dm text-ink" style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>Local perks · offers near you</Text>
    <Glyph name="chevron" size={13} color={colors['fg-muted']} />
  </Pressable>;
}

export function QuietHomeVee() {
  const colors = useThemeColors(), router = useRouter();
  return <Pressable testID="home-evening-ribbon" accessibilityRole="button" accessibilityLabel="Let Vee connect the dots. Plan your evening" onPress={() => router.push('/create')}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 9, opacity: pressed ? .8 : 1 })}>
    <GradientFill radius={13} soft />
    <VeeMark size={20} />
    <Text className="font-dm text-ink" style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>Let Vee connect the dots.</Text>
    <Glyph name="chevron" size={13} color={colors['fg-muted']} />
  </Pressable>;
}
