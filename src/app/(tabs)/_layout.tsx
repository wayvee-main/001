import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { useThemeColors } from '@/lib/theme';

/** Route → what the guest calls it. The first tab is named for the concierge
 * rather than the screen ("Vee", not "Home") because that is what the tab
 * actually opens onto now: Vee's prompt is the first thing on it. */
const TABS: Record<string, { label: string; glyph: string }> = {
  index: { label: 'Vee', glyph: 'spark' },
  discover: { label: 'Tonight', glyph: 'clock' },
  create: { label: 'Plans', glyph: 'calendar' },
  profile: { label: 'You', glyph: 'user' },
};

/** Diameter of the active marker. Small enough to read as punctuation rather
 * than a second control competing with the icon under it. */
const DOT = 5;

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
        paddingTop: 9,
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
            {/* Always laid out, only sometimes painted: an absent dot would
             * shift the icon and label by its height on every tab change. */}
            <View
              style={{
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                backgroundColor: focused ? colors.accent : 'transparent',
              }}
            />
            <Glyph name={tab.glyph} size={21} color={tint} strokeWidth={focused ? 1.8 : 1.5} />
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
