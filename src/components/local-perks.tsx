import { NativePressable as Pressable } from '@/components/native-pressable';
import { useColorScheme } from 'nativewind';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, Easing, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AuroraGlow, GradientFill, IconBadge, useAuroraCard, useGlass } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { CardMetadata } from '@/components/card-metadata';
import { Photo } from '@/components/photo';
import { VeeMark } from '@/components/vee-mark';
import { useActiveCity, useActiveCityName } from '@/lib/city';
import { saveAppearance } from '@/lib/appearance';
import { useNow } from '@/lib/clock';
import { cardMetadata } from '@/lib/card-metadata';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { bannerPageForId, homeRecommendations } from '@/lib/home-recommendations';
import { homeIndexPhotos, type HomeIndexPhoto } from '@/lib/home-index-photos';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { compactOffer, eveningStopKey, localOffers, MAX_EVENING_STOPS, perksAreaKey } from '@/lib/local-perks';
import { useLocalPerks } from '@/lib/local-perks-store';
import { useReducedMotionPreference } from '@/lib/motion';
import { pulseRanges, useAurora } from '@/lib/aurora';
import { useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { todayIso } from '@/lib/stay';
import { useThemeColors } from '@/lib/theme';
import { useEntryActions } from '@/lib/use-entry-actions';
import { isRegionalPoint } from '@/lib/regional-nearby';

const brief = (text: string) => text.trim().split(/\s+/).length > 5 ? text.trim().split(/\s+/).slice(0, 5).join(' ') + '…' : text;

export function PerksRoundButton({ glyph, label, onPress, children, selected = false, glass = false, testID }: {
  glyph?: string; label: string; onPress: () => void; children?: ReactNode; selected?: boolean; glass?: boolean; testID?: string;
}) {
  const colors = useThemeColors(), glassSurface = useGlass(), size = glass ? 40 : 36;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    hitSlop={4} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .72 : 1, ...(glass ? glassSurface : null) })}>
    {children || <Glyph name={glyph || 'chevron'} size={glass ? 19 : 16} color={selected ? colors['accent-fill'] : colors.fg} />}
  </Pressable>;
}

export function LocalPerksHeader({ title, assistant = false, location = true }: { title?: string; profile?: boolean; assistant?: boolean; location?: boolean }) {
  const router = useRouter(), colors = useThemeColors(), activeCity = useActiveCityName(), glass = useGlass();
  const { colorScheme } = useColorScheme();
  const device = useScoper(s => s.deviceLocation), city = isRegionalPoint(device) ? device.label?.split(',')[0]?.trim() || activeCity : activeCity;
  const openStay = useScoper(s => s.openStaySheet), showToast = useScoper(s => s.showToast);
  const openEgg = useLocalPerks(s => s.openEgg), lastTap = useRef(0);
  const tapVee = () => {
    const now = Date.now();
    if (now - lastTap.current < 1200) { lastTap.current = 0; openEgg(); }
    else { lastTap.current = now; showToast('Vee noticed. One more little tap?'); }
  };
  return <View testID={assistant ? 'vee-header' : title ? 'discover-header' : 'home-header'} style={{ paddingTop: 6, gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {!assistant && !title ? <Pressable testID="perks-vee-egg" accessibilityRole="button" accessibilityLabel="Vee. Tap twice for a little extra." onPress={tapVee} hitSlop={5}
          style={{ width: 34, height: 38, marginLeft: -4, alignItems: 'center', justifyContent: 'center' }}><VeeMark size={30} /></Pressable> : null}
        {!assistant ? <Text testID={title ? 'discover-title' : undefined} accessibilityRole="header" numberOfLines={1} className="font-dm-bold text-ink"
          style={title ? { fontSize: 32, lineHeight: 38, letterSpacing: -1.1 } : { fontSize: 24, lineHeight: 30, letterSpacing: -.6 }}>{title || 'Wayvee'}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {!assistant ? <PerksRoundButton glass glyph="ticket" label="Local offers" onPress={() => router.push('/offers')} /> : null}
        <PerksRoundButton glass glyph={colorScheme === 'dark' ? 'sun' : 'moon'} label={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} theme`} onPress={() => void saveAppearance(colorScheme === 'dark' ? 'light' : 'dark')} />
      </View>
    </View>
    {!assistant && location ? <Pressable testID={title ? 'discover-city' : 'home-city'} accessibilityRole="button" accessibilityLabel={`Your starting point. ${city}`} onPress={openStay} hitSlop={6}
      style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, paddingLeft: 10, paddingRight: 12, borderRadius: 17, opacity: pressed ? .72 : 1, ...glass })}>
      <Glyph name="pin" size={15} color={colors['fg-muted']} /><Text numberOfLines={1} className="font-dm text-taupe" style={{ flexShrink: 1, fontSize: 14, lineHeight: 19 }}>{city}</Text>
      <View style={{ transform: [{ rotate: '90deg' }] }}><Glyph name="chevron" size={13} color={colors['fg-muted']} /></View>
    </Pressable> : null}
  </View>;
}

export function PerksPhoto({ entry, catalog, photos: provided, radius = 12, height, width, onUnavailable, retryable = true }: {
  entry?: HomeGuideEntry; catalog: HomeGuideCatalog; photos?: readonly HomeIndexPhoto[]; radius?: number; height: number; width?: number; onUnavailable?: () => void; retryable?: boolean;
}) {
  const photos = provided || (entry ? homeIndexPhotos(entry, catalog) : []);
  return <Photo candidates={photos} fallbackGlyph={entry?.glyph || 'compass'} fallbackLabel={`${entry?.name || 'Local category'} photo unavailable`}
    radius={radius} stripedPlaceholder={false} retryable={retryable} onUnavailable={onUnavailable} style={{ width: width || '100%', height }} />;
}

export function LocalCategoryShelf({ catalog, active, onSelect, tone = 'home' }: { catalog: HomeGuideCatalog; active?: HomeGuideCategory; onSelect?: (category: HomeGuideCategory) => void; tone?: 'home' | 'browse' }) {
  const router = useRouter(), colors = useThemeColors(), aurora = useAurora(), card = useAuroraCard();
  const { width } = useWindowDimensions();
  return <View testID="home-category-shelf" style={{ flexDirection: 'row', gap: width <= 350 ? 8 : 10 }}>
    {(['eat', 'bars', 'routes', 'events'] as const).map(category => {
      const pool = catalog.categories[category], selected = active === category;
      return <Pressable key={category} testID={`${tone === 'browse' ? 'discover-chip' : 'home-category'}-${category}`} accessibilityRole="button" accessibilityLabel={`${HOME_LEDGERS[category].title}. ${pool.length} local options`}
        accessibilityState={{ selected }} onPress={() => onSelect ? onSelect(category) : router.push(HOME_LEDGERS[category].href)}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 88, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 10, opacity: pressed ? .72 : 1, ...card })}>
        {selected ? <GradientFill radius={20} /> : null}
        {selected ? <View><Glyph name={{ eat: 'food', bars: 'drink', routes: 'route', events: 'ticket' }[category]} size={22} color={aurora.onFill} strokeWidth={1.7} /></View>
          : <IconBadge glyph={{ eat: 'food', bars: 'drink', routes: 'route', events: 'ticket' }[category]} size={40} iconSize={19} />}
        <Text numberOfLines={1} className="font-dm-medium" style={{ fontSize: 13, lineHeight: 17, color: selected ? aurora.onFill : colors.fg }}>{HOME_LEDGERS[category].title}</Text>
      </Pressable>;
    })}
  </View>;
}

/** Named, source-backed picks as plain text, each led by a pulsing bolt. Only the bolts move. */
export function HomeTimelyRecommendations({ catalog, now }: { catalog: HomeGuideCatalog; now: Date }) {
  const router = useRouter(), colors = useThemeColors(), reduced = useReducedMotionPreference();
  const openOffer = useLocalPerks(s => s.openOffer), recommendations = homeRecommendations(catalog, now);
  const hasPicks = recommendations.length > 0;
  const [pulse] = useState(() => new Animated.Value(0));
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const animating = hasPicks && !reduced && appActive;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  // One native-driven loop for every bolt; each reads it at its own phase, so the
  // pulse ripples along the row. Stopped for reduced motion, in the background
  // and whenever Home is out of focus.
  useFocusEffect(useCallback(() => {
    pulse.setValue(0);
    if (!animating) return;
    const animation = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    animation.start();
    return () => { animation.stop(); pulse.setValue(0); };
  }, [animating, pulse]));
  return <View testID="home-timely-recommendations" style={{ minHeight: 44, marginHorizontal: -2 }}>
    {hasPicks ? <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled
      contentContainerStyle={{ alignItems: 'center', gap: 22, paddingHorizontal: 2 }}>
      {recommendations.map((suggestion, index) => {
        const phase = (index * 0.125) % 1, venuePrefix = suggestion.label.startsWith(suggestion.venue + ' · ') ? suggestion.venue : suggestion.label === suggestion.venue ? suggestion.venue : '';
        const rest = venuePrefix ? suggestion.label.slice(venuePrefix.length) : suggestion.label;
        return <Pressable key={suggestion.id} testID={`home-recommendation-${suggestion.id}`} accessibilityRole="button"
          accessibilityLabel={`${suggestion.label}. ${suggestion.basis === 'source-popular' ? 'Popular on the published menu' : 'Recently verified nearby'}`}
          onPress={() => suggestion.offer ? openOffer(suggestion.offer) : router.push(suggestion.href as never)}
          style={({ pressed }) => ({ minHeight: 44, maxWidth: 280, flexDirection: 'row', alignItems: 'center', gap: 7, opacity: pressed ? .6 : 1 })}>
          <Animated.View testID="home-recommendation-pulse" accessible={false} style={animating ? {
            opacity: pulse.interpolate(pulseRanges(phase, .35)), transform: [{ scale: pulse.interpolate(pulseRanges(phase, .8)) }] } : undefined}>
            <Glyph name="boltFilled" size={13} color={colors['fg-accent']} />
          </Animated.View>
          <Text numberOfLines={1} className="font-dm" style={{ flexShrink: 1, fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>
            {venuePrefix ? <Text className="font-dm-medium" style={{ color: colors.fg }}>{venuePrefix}</Text> : null}{rest}
          </Text>
        </Pressable>;
      })}
    </ScrollView> : <Text testID="home-recommendations-empty" className="font-dm" style={{ paddingVertical: 13, paddingHorizontal: 2, fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>Fresh local picks are on the way.</Text>}
  </View>;
}

export function PerksHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const colors = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
    <Text accessibilityRole="header" className="font-dm-medium text-ink" style={{ fontSize: 20, lineHeight: 25, letterSpacing: -.4, flex: 1 }}>{title}</Text>
    {action && onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${action} ${title.toLowerCase()}`} onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 1, minHeight: 28 }}>
      <Text className="font-dm-medium" style={{ fontSize: 14, lineHeight: 19, color: colors['fg-accent'] }}>{action}</Text><Glyph name="chevron" size={15} color={colors['fg-accent']} />
    </Pressable> : null}
  </View>;
}

/** A 62px Aurora offer card keeps the actual offer and its conditions together.
 * Preserve the visible slide across source refreshes, including during a swipe. */
export function LocalPerksBanners({ catalog }: { catalog: HomeGuideCatalog; compact?: boolean }) {
  const aurora = useAurora(), card = useAuroraCard(), colors = useThemeColors(), openStay = useScoper(s => s.openStaySheet), openOffer = useLocalPerks(s => s.openOffer);
  const now = useNow(), reduced = useReducedMotionPreference();
  const { fontScale } = useWindowDimensions();
  const offers = localOffers(catalog, now), slides = [...offers.slice(0, 3).map(offer => ({ id: offer.id, offer })), { id: 'stay', offer: undefined }];
  const ref = useRef<ScrollView>(null), [width, setWidth] = useState(300), [selectedId, setSelectedId] = useState(slides[0].id);
  const stride = width + 12;
  const selected = useRef(selectedId), dragging = useRef(false), idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAlignment = useRef(false), lastSwipe = useRef(0);
  const idsKey = JSON.stringify(slides.map(slide => slide.id)), current = bannerPageForId(slides.map(slide => slide.id), selectedId), height = Math.max(62, Math.ceil(36 * fontScale + 24));
  const latest = useRef({ ids: slides.map(slide => slide.id), width: stride });
  const gesture = useRef<typeof latest.current | null>(null);
  // selectedId is deliberately absent: aligning after each selection fights
  // native momentum. Only source/layout changes may realign the carousel.
  useEffect(() => {
    latest.current = { ids: JSON.parse(idsKey), width: stride };
    if (dragging.current) { pendingAlignment.current = true; return; }
    const ids: string[] = JSON.parse(idsKey), page = bannerPageForId(ids, selected.current);
    selected.current = ids[page]; setSelectedId(ids[page]);
    ref.current?.scrollTo({ x: page * stride, animated: false });
  }, [idsKey, stride]);
  useEffect(() => () => clearTimeout(idleTimer.current), []);
  const settle = (offset: number) => {
    clearTimeout(idleTimer.current);
    dragging.current = false;
    const visible = gesture.current || latest.current;
    const targetId = visible.ids[Math.max(0, Math.min(visible.ids.length - 1, Math.round(offset / visible.width)))];
    const page = bannerPageForId(latest.current.ids, targetId);
    selected.current = latest.current.ids[page]; setSelectedId(selected.current);
    if (pendingAlignment.current) ref.current?.scrollTo({ x: page * latest.current.width, animated: false });
    gesture.current = null;
    pendingAlignment.current = false;
  };
  const step = (next: number) => {
    const page = Math.max(0, Math.min(slides.length - 1, next));
    selected.current = slides[page].id; setSelectedId(slides[page].id);
    ref.current?.scrollTo({ x: page * stride, animated: !reduced });
  };
  return <View testID="local-perks-banners" onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setWidth(next); }}>
    <ScrollView ref={ref} testID="perks-banner-scroll" horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={Platform.OS === 'web' ? undefined : stride} pagingEnabled={Platform.OS === 'web'} nestedScrollEnabled directionalLockEnabled contentContainerStyle={{ gap: 12 }}
      scrollEventThrottle={16} onScroll={Platform.OS === 'web' ? event => {
        if (!dragging.current) gesture.current = latest.current;
        dragging.current = true; lastSwipe.current = Date.now();
        clearTimeout(idleTimer.current);
        const offset = event.nativeEvent.contentOffset.x;
        idleTimer.current = setTimeout(() => settle(offset), 160);
      } : undefined}
      onScrollBeginDrag={() => { clearTimeout(idleTimer.current); gesture.current = latest.current; dragging.current = true; lastSwipe.current = Date.now(); }}
      onScrollEndDrag={event => { const offset = event.nativeEvent.contentOffset.x; lastSwipe.current = Date.now(); idleTimer.current = setTimeout(() => settle(offset), 120); }}
      onMomentumScrollBegin={() => { clearTimeout(idleTimer.current); dragging.current = true; }}
      onMomentumScrollEnd={event => { lastSwipe.current = Date.now(); settle(event.nativeEvent.contentOffset.x); }} style={{ height }}>
      {slides.map(slide => {
        const offer = slide.offer, copy = offer ? compactOffer(offer) : { title: 'Link your stay', detail: 'A home base for your next good stop.' };
        return <Pressable key={slide.id} testID={`perks-banner-${offer ? 'offer' : slide.id}`} accessibilityRole="button"
          accessibilityLabel={offer ? `${offer.venue}. ${offer.title}. ${copy.detail}. View offer` : copy.title}
          onPress={() => { if (dragging.current || Date.now() - lastSwipe.current < 250) return; if (offer) openOffer(offer); else openStay(); }}
          style={({ pressed }) => ({ width, height, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 14, paddingVertical: 8, borderRadius: 20, overflow: 'hidden', opacity: pressed ? .78 : 1, ...card })}>
          <View style={{ width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><GradientFill radius={19} /><View><Glyph name={offer ? 'tag' : 'briefcase'} size={18} color={aurora.onFill} strokeWidth={1.8} /></View></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} className="font-dm-medium" style={{ fontSize: 14, lineHeight: 19, color: colors.fg }}>{offer ? `${copy.title} at ${offer.venue}` : copy.title}</Text>
            <Text numberOfLines={1} className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{copy.detail}</Text>
          </View>
          <Glyph name="chevron" size={16} color={colors['fg-muted']} />
        </Pressable>;
      })}
    </ScrollView>
    <View testID="perks-banner-position" accessible accessibilityRole="adjustable" accessibilityLabel="Promotions" accessibilityValue={{ min: 1, max: slides.length, now: current + 1, text: `Banner ${current + 1} of ${slides.length}` }}
      aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={current + 1} aria-valuetext={`Banner ${current + 1} of ${slides.length}`}
      accessibilityActions={[{ name: 'increment', label: 'Next banner' }, { name: 'decrement', label: 'Previous banner' }]}
      onAccessibilityAction={event => step(current + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, height: 13, marginTop: 8 }}>
      {slides.map((slide, i) => <View key={slide.id} accessible={false} style={{ width: current === i ? 16 : 5, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: colors['fg-muted'], opacity: current === i ? 1 : .3 }}>{current === i ? <GradientFill radius={3} /> : null}</View>)}
    </View>
  </View>;
}

export function LocalPerksCard({ entry, catalog, format = 'row', width, photos, onOpen, onPhotoUnavailable }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; format?: 'row' | 'rail' | 'wide'; width?: number; photos?: readonly HomeIndexPhoto[]; onOpen?: () => void; onPhotoUnavailable?: () => void }) {
  const colors = useThemeColors(), surface = useRaisedSurface(1), router = useRouter(), now = useNow();
  const rail = format !== 'row', key = eveningStopKey(entry);
  const { saved, canSave, save, added, add } = useEntryActions(entry);
  const metadata = cardMetadata(entry, now, rail ? 3 : 2);
  const photoHeight = rail ? 108 : 64;
  return <View testID="local-perks-card" style={[surface, { width, borderWidth: 0, borderRadius: 18, overflow: 'hidden', flexShrink: 0 }]}>
    <Pressable testID="perks-place-open" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${entry.caption}`} onPress={onOpen || (() => router.push(homeGuideHref(entry) as never))}
      style={({ pressed }) => ({ flexDirection: rail ? 'column' : 'row', gap: rail ? 0 : 10, padding: rail ? 10 : 8, opacity: pressed ? .78 : 1, alignItems: rail ? 'stretch' : 'center', minHeight: rail ? undefined : 86 })}>
      <View style={{ width: rail ? '100%' : 64, position: 'relative' }}>
        <PerksPhoto key={key} entry={entry} catalog={catalog} photos={photos} height={photoHeight} width={rail ? undefined : 64} radius={rail ? 12 : 10} onUnavailable={onPhotoUnavailable} />
      </View>
      <View style={{ flex: rail ? undefined : 1, minWidth: 0, paddingTop: rail ? 10 : 0, paddingBottom: rail ? 2 : 0, gap: rail ? 6 : 3 }}>
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink" style={{ fontSize: rail && format === 'wide' ? 24 : 20, lineHeight: rail && format === 'wide' ? 29 : 25, letterSpacing: -.5 }}>{brief(entry.name)}</Text>
        {entry.caption ? <Text numberOfLines={1} className="font-dm text-taupe" style={{ fontSize: 11, lineHeight: 17 }}>{entry.caption}</Text> : null}
        <View style={{ paddingTop: rail ? 3 : 1 }}><CardMetadata items={metadata.items} note={metadata.note} /></View>
      </View>
      {!rail ? <Glyph name="chevron" size={14} color={colors['fg-accent']} /> : null}
    </Pressable>
    {canSave && rail ? <Pressable testID="perks-save-place" accessibilityRole="button" accessibilityLabel={`${saved ? 'Unsave' : 'Save'} ${entry.name}`} accessibilityState={{ selected: saved }} onPress={save} hitSlop={5}
      style={({ pressed }) => ({ position: 'absolute', top: 11, right: 11, width: 30, height: 30, borderRadius: 15, backgroundColor: colors['surface-control'], borderWidth: 1, borderColor: colors['edge-card'], alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><Glyph name={saved ? 'check' : 'heart'} size={16} color={saved ? colors['accent-fill'] : colors.fg} /></Pressable> : null}
    {rail ? <Pressable testID="perks-add-stop" accessibilityRole="button" accessibilityLabel={`${added ? 'Remove' : 'Add'} ${entry.name} ${added ? 'from' : 'to'} your evening`} accessibilityState={{ selected: added }} onPress={add} hitSlop={5}
      style={({ pressed }) => ({ position: 'absolute', top: photoHeight - 16, right: 18, width: 28, height: 28, borderRadius: 14, backgroundColor: added ? colors['accent-tint'] : colors['surface-control'], borderWidth: 1, borderColor: colors['control-edge'], alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><Glyph name={added ? 'check' : 'plus'} size={14} color={colors['fg-accent']} /></Pressable> : null}
  </View>;
}

export function PerksVeeRibbon() {
  const router = useRouter(), colors = useThemeColors(), aurora = useAurora(), card = useAuroraCard();
  return <Pressable testID="home-evening-ribbon" accessibilityRole="button" accessibilityLabel="Let Vee find your kind of night" onPress={() => router.push('/create')}
    style={({ pressed }) => ({ minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 24, overflow: 'hidden', paddingVertical: 16, paddingLeft: 18, paddingRight: 16, opacity: pressed ? .8 : 1, ...card })}>
    <AuroraGlow height={110} />
    <VeeMark size={34} />
    <View style={{ flex: 1, gap: 2 }}><Text className="font-dm-medium text-ink" style={{ fontSize: 16, lineHeight: 21 }}>Good plans start small.</Text><Text className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>Tell Vee what you’re in the mood for.</Text></View>
    <View style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><GradientFill radius={21} /><View><Glyph name="arrow" size={18} color={aurora.onFill} strokeWidth={2} /></View></View>
  </Pressable>;
}

export function PerksRail({ entries, catalog }: { entries: readonly HomeGuideEntry[]; catalog: HomeGuideCatalog }) {
  const [width, setWidth] = useState(310), cardWidth = Math.min(340, Math.max(280, width * .82));
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <ScrollView testID="perks-place-rail" horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 11} decelerationRate="fast" contentContainerStyle={{ gap: 11, paddingVertical: 3 }}>
      {entries.map(entry => <LocalPerksCard key={eveningStopKey(entry)} entry={entry} catalog={catalog} format="rail" width={cardWidth} />)}
    </ScrollView>
  </View>;
}

export function PerksEveningAction({ entry }: { entry: HomeGuideEntry }) {
  const colors = useThemeColors(), perks = useLocalPerks(), activeCity = useActiveCity(), showToast = useScoper(s => s.showToast), device = useScoper(s => s.deviceLocation);
  const city = perksAreaKey(activeCity, device);
  const stops = perks.date === todayIso() ? perks.stops.filter(stop => stop.city === city) : [];
  const added = stops.some(stop => eveningStopKey(stop) === eveningStopKey(entry));
  const toggle = () => {
    if (!added && stops.length >= MAX_EVENING_STOPS) { showToast('Keep up to eight stops in an evening.'); return; }
    perks.toggleStop({ kind: entry.kind, id: entry.id, name: entry.name, caption: entry.caption, image: entry.image, glyph: entry.glyph, facts: entry.facts, city });
  };
  return <Pressable testID="perks-detail-add" accessibilityRole="button" accessibilityState={{ selected: added }} accessibilityLabel={added ? 'Remove from your evening' : 'Add to your evening'} onPress={toggle}
    style={({ pressed }) => ({ minHeight: 44, borderRadius: 24, backgroundColor: colors['accent-fill'], opacity: pressed ? .74 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 })}>
    <Glyph name={added ? 'check' : 'plus'} size={16} color={colors['on-accent']} /><Text className="font-dm-medium text-label" style={{ color: colors['on-accent'] }}>{added ? 'In your evening' : 'Add to your evening'}</Text>
  </Pressable>;
}

export function EveningTray() {
  const router = useRouter(), colors = useThemeColors(), activeCity = useActiveCity(), now = useNow(), perks = useLocalPerks(), device = useScoper(s => s.deviceLocation);
  const city = perksAreaKey(activeCity, device);
  const stops = perks.date === todayIso(now) ? perks.stops.filter(stop => stop.city === city) : [];
  if (!stops.length) return null;
  return <View testID="perks-evening-tray" style={{ backgroundColor: colors['page-tertiary'], borderTopWidth: 1, borderTopColor: colors['edge-card'], paddingHorizontal: 16, paddingVertical: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Your evening. ${stops.length} ${stops.length === 1 ? 'stop' : 'stops'}. View evening`} onPress={() => router.push('/evening')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 38 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors['accent-tint'], alignItems: 'center', justifyContent: 'center' }}><Text className="font-dm-medium text-label text-peach">{stops.length}</Text></View>
      <View style={{ flex: 1, gap: 2 }}><Text className="font-dm-medium text-label text-ink">Your evening</Text><Text className="font-dm text-fine text-taupe">{stops.length} {stops.length === 1 ? 'stop' : 'stops'} · A little room for more</Text></View>
      <Text className="font-dm text-fine text-peach">View</Text><Glyph name="chevron" size={13} color={colors['fg-accent']} />
    </Pressable>
  </View>;
}
