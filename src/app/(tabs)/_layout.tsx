import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

/** Route → what the guest calls it.
 *
 * The first tab is Home again: it is the browsing screen, and calling it Vee
 * promised a concierge that lived one tab over. `create` carries that name
 * now, which is what it always was — 1,200 lines of composer and result, with
 * saved plans on their own route off You.
 *
 * Vee's tab draws the mark itself rather than a glyph from the set. It is the
 * only tab that is a thing rather than a category, and the mark is how the app
 * says so everywhere else. */
const TABS: Record<string, { label: string; glyph: string }> = {
  index: { label: 'Home', glyph: 'home' },
  discover: { label: 'Tonight', glyph: 'clock' },
  create: { label: 'Vee', glyph: 'spark' },
  profile: { label: 'You', glyph: 'user' },
};

function WayveeTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) return null;

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
      {state.routes.map((route: { key: string; name: string }, index: number) => {
        const focused = state.index === index;
        const tab = TABS[route.name];
        if (!tab) return null;
        const tint = focused ? colors['fg-accent'] : colors['fg-muted'];
        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            activeOpacity={0.6}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1 }}
            className="items-center justify-start gap-y-[3px] pb-0.5">
            {/* Tint and weight already say which tab is selected; a dot over
             * the icon was a third signal saying the same thing, and it had to
             * be laid out even when unpainted so the icon would not jump. */}
            {route.name === 'create' ? (
              <VeeMark size={21} variant="compact" color={tint} strokeWidth={focused ? 3.2 : 2.7} />
            ) : (
              <Glyph name={tab.glyph} size={21} color={tint} strokeWidth={focused ? 1.8 : 1.5} />
            )}
            <Text
              numberOfLines={1}
              style={{ color: tint }}
              className={focused ? 'font-dm-bold text-meta' : 'font-dm-medium text-meta'}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <WayveeTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
