import { NativePressable as Pressable } from '@/components/native-pressable';
import { Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { EveningTray } from '@/components/local-perks';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

export interface NavigationItem { key: string; label: string; glyph: string; selected: boolean; onPress: () => void }

/** City Desk's anchored navigation: an opaque ground and a quiet active tint. */
export function EditorialNav({ items, reserveSpace = false }: { items: NavigationItem[]; reserveSpace?: boolean }) {
  const colors = useThemeColors(), insets = useSafeAreaInsets();
  return <View style={[{ backgroundColor: colors['surface-navigation'], paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8), borderTopWidth: 1, borderTopColor: colors['control-edge'] }, reserveSpace ? undefined : { position: 'absolute', left: 0, right: 0, bottom: 0 }]}>
    <EveningTray />
    <View testID="editorial-navigation" accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, backgroundColor: colors['surface-navigation'], paddingHorizontal: 13 } as ViewStyle}>
      {items.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.selected }} accessibilityLabel={item.label} onPress={item.onPress}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 50, borderRadius: 10, backgroundColor: item.selected ? colors['accent-tint'] : 'transparent', overflow: 'hidden', opacity: pressed ? .65 : 1 })}>
        <View style={{ height: 26, width: 28, alignItems: 'center', justifyContent: 'center' }}>
          {item.key === 'create' ? <VeeMark size={24} variant="compact" /> : <Glyph name={item.glyph} size={20} color={item.selected ? colors['pill-ink'] : colors['fg-muted']} strokeWidth={1.7} />}
        </View>
        <Text numberOfLines={1} className="font-dm-medium" style={{ fontSize: 11, lineHeight: 16, color: item.selected ? colors['pill-ink'] : colors['fg-muted'] }}>{item.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
