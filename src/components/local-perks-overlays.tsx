import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/components/glyph';
import { LocalPerksCard, PerksRoundButton } from '@/components/local-perks';
import { VeeMark } from '@/components/vee-mark';
import { homeGuideHref } from '@/lib/home-guide';
import { eveningStopKey, veeWildcard } from '@/lib/local-perks';
import { useLocalPerks } from '@/lib/local-perks-store';
import { useReducedMotionPreference } from '@/lib/motion';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { withAlpha } from '@/lib/tokens';
import { useHomeGuide } from '@/lib/use-home-guide';

function EggMark() {
  const [turn] = useState(() => new Animated.Value(0)), reduced = useReducedMotionPreference();
  useEffect(() => { if (reduced) return; const animation = Animated.timing(turn, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }); animation.start(); return () => animation.stop(); }, [reduced, turn]);
  return <Animated.View style={{ alignSelf: 'center', marginVertical: 10, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '360deg'] }) }] }}><VeeMark size={66} /></Animated.View>;
}

/** Native sheets share the same surface and honor Android Back/reduced motion. */
export function LocalPerksOverlays() {
  const perks = useLocalPerks(), colors = useThemeColors(), insets = useSafeAreaInsets(), router = useRouter(), s = useScoper();
  const { catalog } = useHomeGuide(), reduced = useReducedMotionPreference(), lastSaved = useRef(s.savedPlaceKeys.length), lastUser = useRef(s.session?.user.id), eggSeen = useRef(false);
  const visible = Boolean(perks.offer || perks.eggOpen), wildcard = veeWildcard(catalog, perks.eggRoll), offer = perks.offer;
  useEffect(() => {
    const count = s.savedPlaceKeys.length;
    if (lastUser.current !== s.session?.user.id) { lastUser.current = s.session?.user.id; lastSaved.current = count; }
    if (!eggSeen.current && lastSaved.current < 3 && count === 3 && s.userDataReady) { eggSeen.current = true; perks.openEgg(); }
    lastSaved.current = count;
  }, [s.savedPlaceKeys.length, s.session?.user.id, s.userDataReady, perks]);
  const close = () => { perks.openOffer(null); perks.closeEgg(); };
  const open = (href: string) => { close(); router.push(href as never); };
  const button = (label: string, onPress: () => void, secondary = false, glyph?: string) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 43, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 16,
      backgroundColor: secondary ? colors['surface-control'] : colors['accent-fill'], borderWidth: 1, borderColor: colors['edge-card'], opacity: pressed ? .74 : 1, flexGrow: 1 })}>
    {glyph ? <Glyph name={glyph} size={15} color={secondary ? colors.fg : colors['on-accent']} /> : null}<Text className="font-dm-medium text-label" style={{ color: secondary ? colors.fg : colors['on-accent'] }}>{label}</Text>
  </Pressable>;
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: withAlpha(colors.fg, .38) }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={close} style={{ position: 'absolute', inset: 0 }} />
      <View accessibilityViewIsModal testID={offer ? 'perks-offer-sheet' : 'perks-egg-sheet'} style={{ backgroundColor: colors['page-tertiary'], borderRadius: 25, marginHorizontal: 10, marginBottom: Math.max(10, insets.bottom), padding: 18, maxHeight: '88%' }}>
        <View style={{ width: 30, height: 4, borderRadius: 2, backgroundColor: colors['control-edge'], alignSelf: 'center', marginBottom: 13 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <Text accessibilityRole="header" className="font-fraunces text-ink" style={{ fontSize: 22, lineHeight: 27, flex: 1 }}>{offer ? 'A little extra, locally.' : 'Vee’s side door.'}</Text><PerksRoundButton glyph="close" label="Close dialog" onPress={close} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {offer ? <>
            <Text className="font-dm text-fine uppercase text-taupe" style={{ letterSpacing: .8 }}>{offer.venue} · Venue-listed offer</Text>
            <Text className="font-fraunces text-ink" style={{ fontSize: 31, lineHeight: 36 }}>{offer.title}</Text>
            <Text className="font-dm-medium text-label text-peach">{offer.label}</Text>
            <Text className="font-dm text-body text-taupe">{offer.description}</Text>
            <Text className="font-dm text-fine text-taupe">Confirm current availability with the venue.</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Official offer and terms" onPress={() => { void Linking.openURL(offer.url).catch(() => s.showToast('Could not open the official offer.')); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38 }}><Glyph name="shield" size={14} color={colors['fg-accent']} /><Text className="font-dm text-fine text-peach">Official offer & terms</Text><Glyph name="chevron" size={12} color={colors['fg-accent']} /></Pressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{button('View venue', () => open(offer.href), false, 'chevron')}{button(perks.savedOffers.includes(offer.id) ? 'Saved' : 'Save offer', () => perks.toggleOffer(offer.id), true, 'bookmark')}</View>
          </> : <>
            <EggMark /><Text className="font-dm text-fine uppercase text-taupe" style={{ alignSelf: 'center', letterSpacing: .8 }}>You found a little extra.</Text>
            <Text className="font-fraunces text-ink" style={{ textAlign: 'center', fontSize: 24, lineHeight: 29, marginBottom: 7 }}>A good detour rarely announces itself.</Text>
            {wildcard ? <LocalPerksCard key={eveningStopKey(wildcard)} entry={wildcard} catalog={catalog} format="row" onOpen={() => open(homeGuideHref(wildcard))} /> : <Text className="font-dm text-label text-taupe">A little room for curiosity. New local finds appear as the city’s catalog grows.</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{wildcard ? button('Take a closer look', () => open(homeGuideHref(wildcard)), false, 'chevron') : button('Explore the city', () => open('/discover'))}{button('Another?', perks.reroll, true, 'refresh')}</View>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
