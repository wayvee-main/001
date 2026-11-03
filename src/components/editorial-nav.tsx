import { NativePressable as Pressable } from '@/components/native-pressable';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { EveningTray } from '@/components/local-perks';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

export interface NavigationItem { key: string; label: string; glyph: string; selected: boolean; onPress: () => void }

/** Opaque, full-width Local Perks chrome with a single underline active state. */
export function EditorialNav({ items, reserveSpace = false }: { items: NavigationItem[]; reserveSpace?: boolean }) {
  const colors = useThemeColors(), insets = useSafeAreaInsets();
  return <View style={reserveSpace ? undefined : { position: 'absolute', left: 0, right: 0, bottom: 0 }}>
    <EveningTray />
    <View testID="editorial-navigation" accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors['surface-navigation'], borderTopWidth: 1,
      borderTopColor: colors['edge-card'], paddingHorizontal: 9, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 9) }}>
      {items.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.selected }} accessibilityLabel={item.label} onPress={item.onPress}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 4, minHeight: 47, paddingTop: 2, opacity: pressed ? .65 : 1 })}>
        {item.key === 'create' ? <VeeMark size={22} variant="compact" /> : <Glyph name={item.glyph} size={18} color={item.selected ? colors['accent-fill'] : colors['fg-muted']} strokeWidth={1.6} />}
        <Text numberOfLines={1} className="font-dm" style={{ fontSize: 10, lineHeight: 14, color: item.selected ? colors['fg-accent'] : colors['fg-muted'] }}>{item.label}</Text>
        <View testID="editorial-tab-indicator" style={{ height: 2, width: 14, borderRadius: 1, backgroundColor: item.selected ? colors['accent-fill'] : 'transparent' }} />
      </Pressable>)}
    </View>
  </View>;
}
