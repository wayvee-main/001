import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

/** Mirrors (tabs)/_layout.tsx exactly — same labels, glyphs, strip treatment.
 * Two copies exist because pushed detail screens live outside the tab
 * navigator; they must not drift apart. */
const ITEMS = [
  { key: 'home', label: 'Home', href: '/', glyph: 'home' },
  { key: 'discover', label: 'Discover', href: '/discover', glyph: 'compass' },
  { key: 'create', label: 'Vee', href: '/create', glyph: 'spark' },
  { key: 'profile', label: 'You', href: '/profile', glyph: 'user' },
] as const;

/** Shared tab treatment for place-detail screens. */
export function DetailBottomNav({ active = 'home' }: { active?: (typeof ITEMS)[number]['key'] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      style={{
        backgroundColor: colors['surface-raised'],
        borderTopColor: colors.edge,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 11,
      }}
      className="flex-row items-start">
      {ITEMS.map((item) => {
        const selected = item.key === active;
        const tint = selected ? colors['fg-accent'] : colors['fg-muted'];
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            activeOpacity={0.6}
            onPress={() => router.replace(item.href)}
            style={{ flex: 1 }}
            className="items-center justify-start gap-y-[3px] pb-0.5">
            {/* Tint and weight already say which tab is selected; a dot over
             * the icon was a third signal saying the same thing, and it had to
             * be laid out even when unpainted so the icon would not jump. */}
            {item.key === 'create' ? (
              <VeeMark size={21} variant="compact" color={tint} strokeWidth={selected ? 3.2 : 2.7} />
            ) : (
              <Glyph name={item.glyph} size={21} color={tint} strokeWidth={selected ? 1.8 : 1.5} />
            )}
            <Text
              numberOfLines={1}
              style={{ color: tint }}
              className={selected ? 'font-dm-bold text-meta' : 'font-dm-medium text-meta'}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
