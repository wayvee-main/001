import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { useThemeColors } from '@/lib/theme';

/** Mirrors (tabs)/_layout.tsx exactly — same labels, glyphs, strip treatment.
 * Two copies exist because pushed detail screens live outside the tab
 * navigator; they must not drift apart. */
const ITEMS = [
  { key: 'home', label: 'Vee', href: '/', glyph: 'spark' },
  { key: 'discover', label: 'Tonight', href: '/discover', glyph: 'clock' },
  { key: 'create', label: 'Plans', href: '/create', glyph: 'calendar' },
  { key: 'profile', label: 'You', href: '/profile', glyph: 'user' },
] as const;

/** Diameter of the active marker. Keep in step with (tabs)/_layout.tsx. */
const DOT = 5;

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
        paddingTop: 9,
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
            {/* Always laid out, only sometimes painted: an absent dot would
             * shift the icon and label by its height on every tab change. */}
            <View
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                backgroundColor: selected ? colors.accent : 'transparent',
              }}
            />
            <Glyph name={item.glyph} size={21} color={tint} strokeWidth={selected ? 1.8 : 1.5} />
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
