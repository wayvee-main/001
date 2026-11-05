import { NativePressable as Pressable } from '@/components/native-pressable';
import { Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientFill } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { EveningTray } from '@/components/local-perks';
import { VeeMark } from '@/components/vee-mark';
import { useAurora } from '@/lib/aurora';
import { useThemeColors } from '@/lib/theme';

export interface NavigationItem { key: string; label: string; glyph: string; selected: boolean; onPress: () => void }

/** Aurora's floating capsule: a near-opaque frosted bar with the active tab in the
 * gradient fill. Detail routes reserve its space on an opaque ground instead. */
export function EditorialNav({ items, reserveSpace = false }: { items: NavigationItem[]; reserveSpace?: boolean }) {
  const colors = useThemeColors(), aurora = useAurora(), insets = useSafeAreaInsets();
  return <View style={[{ backgroundColor: reserveSpace ? colors.bg : 'transparent', paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }, reserveSpace ? undefined : { position: 'absolute', left: 0, right: 0, bottom: 0 }]}>
    <EveningTray />
    <View testID="editorial-navigation" accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: aurora.navigation, borderRadius: 999, borderWidth: 1, borderColor: aurora.glassEdge,
      boxShadow: aurora.shadow, marginHorizontal: 16, padding: 6 } as ViewStyle}>
      {items.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.selected }} accessibilityLabel={item.label} onPress={item.onPress}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 50, borderRadius: 999, overflow: 'hidden', opacity: pressed ? .65 : 1 })}>
        {item.selected ? <View testID="nav-active-fill" pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}><GradientFill /></View> : null}
        <View style={{ height: 26, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: item.key === 'create' && item.selected ? colors['surface-raised'] : 'transparent' }}>
          {item.key === 'create' ? <VeeMark size={24} variant="compact" /> : <Glyph name={item.glyph} size={18} color={item.selected ? aurora.onFill : colors['fg-muted']} strokeWidth={1.7} />}
        </View>
        <Text numberOfLines={1} className="font-dm-medium" style={{ fontSize: 11, lineHeight: 16, color: item.selected ? aurora.onFill : colors['fg-muted'] }}>{item.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
