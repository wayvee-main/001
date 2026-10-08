import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '@/components/glyph';
import { EDITORIAL_FONTS, useEditorial } from '@/lib/editorial';

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
  const { c } = useEditorial();
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
        backgroundColor: c.paper,
        borderTopColor: c.line,
        borderTopWidth: 1,
        paddingBottom: Math.max(insets.bottom, 18),
        paddingTop: 13,
      }}
      >
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: 390, alignSelf: 'center', paddingHorizontal: 10 }}>
      {state.routes.map((route: { key: string; name: string }, index: number) => {
        const focused = state.index === index;
        const tab = TABS[route.name];
        if (!tab) return null;
        const tint = focused ? c.coral : c.muted;
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
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}>
            {/* Tint and weight already say which tab is selected; a dot over
             * the icon was a third signal saying the same thing, and it had to
             * be laid out even when unpainted so the icon would not jump. */}
            <Glyph name={tab.glyph} size={23} color={route.name === 'create' ? c.violet : tint} strokeWidth={2} />
            <Text
              numberOfLines={1}
              style={{ color: tint, fontFamily: focused ? EDITORIAL_FONTS.strong : EDITORIAL_FONTS.regular, fontSize: 10, lineHeight: 14 }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      </View>
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
