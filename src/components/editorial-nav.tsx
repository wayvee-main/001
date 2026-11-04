import { NativePressable as Pressable } from '@/components/native-pressable';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { EveningTray } from '@/components/local-perks';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

export interface NavigationItem { key: string; label: string; glyph: string; selected: boolean; onPress: () => void }

/** Daybreak's floating capsule; every active tab gets the same rounded fill. */
export function EditorialNav({ items, reserveSpace = false }: { items: NavigationItem[]; reserveSpace?: boolean }) {
  const colors = useThemeColors(), insets = useSafeAreaInsets();
  return <View style={[{ backgroundColor: colors.bg, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }, reserveSpace ? undefined : { position: 'absolute', left: 0, right: 0, bottom: 0 }]}>
    <EveningTray />
    <View testID="editorial-navigation" accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors['surface-navigation'], borderRadius: 999,
      marginHorizontal: 12, paddingHorizontal: 5, paddingVertical: 7 }}>
      {items.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.selected }} accessibilityLabel={item.label} onPress={item.onPress}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 48, borderRadius: 999,
          backgroundColor: item.selected ? colors['accent-fill'] : 'transparent', opacity: pressed ? .65 : 1 })}>
        <View style={{ height: 26, width: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: item.key === 'create' && item.selected ? colors['surface-input'] : 'transparent' }}>
          {item.key === 'create' ? <VeeMark size={24} variant="compact" /> : <Glyph name={item.glyph} size={18} color={item.selected ? colors['on-accent'] : colors['fg-muted']} strokeWidth={1.6} />}
        </View>
        <Text numberOfLines={1} className="font-dm" style={{ fontSize: 11, lineHeight: 16, color: item.selected ? colors['on-accent'] : colors['fg-muted'] }}>{item.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
