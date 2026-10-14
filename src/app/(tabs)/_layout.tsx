import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

import { EditorialNav } from '@/components/editorial-nav';

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
  discover: { label: 'Discover', glyph: 'compass' },
  create: { label: 'Vee', glyph: 'spark' },
  profile: { label: 'You', glyph: 'user' },
};

function WayveeTabBar({ state, navigation }: any) {
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

  return <EditorialNav items={state.routes.flatMap((route: {key:string;name:string}, index:number) => {
    const tab=TABS[route.name];
    if(!tab)return [];
    const selected=state.index===index;
    return [{key:route.name,label:tab.label,glyph:tab.glyph,selected,onPress:()=>{
      const event=navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true});
      if(!selected&&!event.defaultPrevented)navigation.navigate(route.name);
    }}];
  })} />;
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
