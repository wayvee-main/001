import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { EDITORIAL_FONTS, useEditorial } from '@/lib/editorial';

/** Mirrors (tabs)/_layout.tsx exactly — same labels, glyphs, strip treatment.
 * Two copies exist because pushed detail screens live outside the tab
 * navigator; they must not drift apart. */
const ITEMS = [
  { key: 'home', label: 'Home', href: '/', glyph: 'home' },
  { key: 'discover', label: 'Tonight', href: '/discover', glyph: 'clock' },
  { key: 'create', label: 'Vee', href: '/create', glyph: 'spark' },
  { key: 'profile', label: 'You', href: '/profile', glyph: 'user' },
] as const;

/** Shared tab treatment for place-detail screens. */
export function DetailBottomNav({ active = 'home' }: { active?: (typeof ITEMS)[number]['key'] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useEditorial();

  return (
    <View
      style={{
        backgroundColor: c.paper,
        borderTopColor: c.line,
        borderTopWidth: 1,
        paddingBottom: Math.max(insets.bottom, 18),
        paddingTop: 13,
      }}
      >
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: 390, alignSelf: 'center', paddingHorizontal: 10 }}>
      {ITEMS.map((item) => {
        const selected = item.key === active;
        const tint = selected ? c.coral : c.muted;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            activeOpacity={0.6}
            onPress={() => router.replace(item.href)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}>
            <Glyph name={item.glyph} size={23} color={item.key === 'create' ? c.violet : tint} strokeWidth={2} />
            <Text
              numberOfLines={1}
              style={{ color: tint, fontFamily: selected ? EDITORIAL_FONTS.strong : EDITORIAL_FONTS.regular, fontSize: 10, lineHeight: 14 }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      </View>
    </View>
  );
}
