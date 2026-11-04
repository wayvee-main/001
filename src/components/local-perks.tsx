import { NativePressable as Pressable } from '@/components/native-pressable';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, Easing, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { VeeMark } from '@/components/vee-mark';
import { useActiveCity, useActiveCityName } from '@/lib/city';
import { useNow } from '@/lib/clock';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { bannerPageForId, homeRecommendations } from '@/lib/home-recommendations';
import { homeIndexPhotos, type HomeIndexPhoto } from '@/lib/home-index-photos';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { compactOffer, eveningStopKey, localOffers, MAX_EVENING_STOPS, perksAreaKey } from '@/lib/local-perks';
import { useLocalPerks } from '@/lib/local-perks-store';
import { useReducedMotionPreference } from '@/lib/motion';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { todayIso } from '@/lib/stay';
import { useThemeColors } from '@/lib/theme';
import { isRegionalPoint } from '@/lib/regional-nearby';
import { useWeatherNow, weatherLine } from '@/lib/weather';

const brief = (text: string) => text.trim().split(/\s+/).length > 5 ? text.trim().split(/\s+/).slice(0, 5).join(' ') + '…' : text;

export function PerksRoundButton({ glyph, label, onPress, children, selected = false, testID }: {
  glyph?: string; label: string; onPress: () => void; children?: ReactNode; selected?: boolean; testID?: string;
}) {
  const colors = useThemeColors(), surface = useControlSurface();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={({ pressed }) => [surface, { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .72 : 1, boxShadow: 'none' }]}>
    {children || <Glyph name={glyph || 'chevron'} size={16} color={selected ? colors['accent-fill'] : colors.fg} />}
  </Pressable>;
}

export function LocalPerksHeader({ title, profile = true }: { title?: string; profile?: boolean }) {
  const router = useRouter(), colors = useThemeColors(), activeCity = useActiveCityName(), weather = useWeatherNow();
  const device = useScoper(s => s.deviceLocation), city = isRegionalPoint(device) ? device.label?.split(',')[0]?.trim() || activeCity : activeCity;
  const openStay = useScoper(s => s.openStaySheet), showToast = useScoper(s => s.showToast);
  const openEgg = useLocalPerks(s => s.openEgg), lastTap = useRef(0);
  const tapVee = () => {
    const now = Date.now();
    if (now - lastTap.current < 1200) { lastTap.current = 0; openEgg(); }
    else { lastTap.current = now; showToast('Vee noticed. One more little tap?'); }
  };
  return <View testID={title ? 'discover-header' : 'home-header'} style={{ paddingTop: 10, gap: 7 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        {!title ? <Pressable testID="perks-vee-egg" accessibilityRole="button" accessibilityLabel="Vee. Tap twice for a little extra." onPress={tapVee} hitSlop={5}
          style={{ width: 34, height: 38, marginLeft: -5, alignItems: 'center', justifyContent: 'center' }}><VeeMark size={32} /></Pressable> : null}
        <Text testID={title ? 'discover-title' : undefined} accessibilityRole="header" numberOfLines={1} className="font-fraunces text-ink" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -.7 }}>{title || 'Wayvee'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 7 }}>
        <PerksRoundButton glyph="tag" label="Local offers" onPress={() => router.push('/offers')} />
        {profile ? <PerksRoundButton glyph="user" label="Your profile" onPress={() => router.push('/profile')} /> : null}
      </View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Pressable testID={title ? 'discover-city' : 'home-city'} accessibilityRole="button" accessibilityLabel={`Your starting point. ${city}`} onPress={openStay} hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 23, flexShrink: 1 }}>
        <Glyph name="pin" size={13} color={colors['fg-muted']} /><Text numberOfLines={1} className="font-dm text-meta text-taupe" style={{ flexShrink: 1 }}>{city}</Text>
        <View style={{ transform: [{ rotate: '90deg' }] }}><Glyph name="chevron" size={11} color={colors['fg-muted']} /></View>
      </Pressable>
      {weather ? <Text testID="home-weather" numberOfLines={1} className="font-dm text-fine text-taupe" style={{ flexShrink: 1 }}>{weatherLine(weather)}</Text> : null}
    </View>
  </View>;
}

export function PerksPhoto({ entry, catalog, photos: provided, radius = 13, height, width, onUnavailable }: {
  entry?: HomeGuideEntry; catalog: HomeGuideCatalog; photos?: readonly HomeIndexPhoto[]; radius?: number; height: number; width?: number; onUnavailable?: () => void;
}) {
  const photos = provided || (entry ? homeIndexPhotos(entry, catalog) : []);
  return <Photo candidates={photos} fallbackGlyph={entry?.glyph || 'compass'} fallbackLabel={`${entry?.name || 'Local category'} photo unavailable`}
    radius={radius} stripedPlaceholder={false} onUnavailable={onUnavailable} style={{ width: width || '100%', height }} />;
}

export function LocalCategoryShelf({ catalog, active, onSelect }: { catalog: HomeGuideCatalog; active?: HomeGuideCategory; onSelect?: (category: HomeGuideCategory) => void }) {
  const router = useRouter(), colors = useThemeColors();
  const { width } = useWindowDimensions();
  return <View testID="home-category-shelf" style={{ flexDirection: 'row', gap: 7 }}>
    {(['eat', 'bars', 'routes', 'events'] as const).map(category => {
      const pool = catalog.categories[category], selected = active === category;
      return <Pressable key={category} testID={`home-category-${category}`} accessibilityRole="button" accessibilityLabel={`${HOME_LEDGERS[category].title}. ${pool.length} local options`}
        accessibilityState={{ selected }} onPress={() => onSelect ? onSelect(category) : router.push(HOME_LEDGERS[category].href)}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 999, justifyContent: 'center', opacity: pressed ? .72 : 1 })}>
        <View style={{ minHeight: 37, borderRadius: 999, flexDirection: 'row', gap: width <= 350 ? 3 : 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors['edge-faint'],
          paddingHorizontal: width <= 350 ? 2 : 6, paddingVertical: 7, backgroundColor: selected ? colors['selected-surface'] : 'transparent' }}>
          <Glyph name={{ eat: 'food', bars: 'drink', routes: 'route', events: 'ticket' }[category]} size={width <= 350 ? 11 : 12} strokeWidth={1.5} color={selected ? colors['on-selected'] : colors['fg-muted']} />
          <Text numberOfLines={1} className="font-fraunces" style={{ fontSize: width <= 350 ? 13 : 15, lineHeight: 20, color: selected ? colors['on-selected'] : colors['fg-muted'] }}>{HOME_LEDGERS[category].title}</Text>
        </View>
      </Pressable>;
    })}
  </View>;
}

/** Named, source-backed picks. Only the divider dots breathe; text stays still. */
export function HomeTimelyRecommendations({ catalog, now }: { catalog: HomeGuideCatalog; now: Date }) {
  const router = useRouter(), colors = useThemeColors(), reduced = useReducedMotionPreference();
  const openOffer = useLocalPerks(s => s.openOffer), recommendations = homeRecommendations(catalog, now);
  const hasPicks = recommendations.length > 0;
  const hasDividers = recommendations.length > 1;
  const [pulse] = useState(() => new Animated.Value(1));
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => {
    pulse.setValue(1);
    if (reduced || !appActive || !hasDividers) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: .55, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); pulse.setValue(1); };
  }, [appActive, hasDividers, pulse, reduced]));
  return <View testID="home-timely-recommendations" style={{ minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors['edge-faint'] }}>
    {hasPicks ? <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled
      contentContainerStyle={{ alignItems: 'center' }}>
      {recommendations.map((suggestion, index) => <View key={suggestion.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
        {index > 0 ? <Animated.View testID="home-recommendation-pulse" accessible={false} style={{ width: 3, height: 3, borderRadius: 2, marginHorizontal: 12, backgroundColor: colors['fg-muted'], opacity: pulse }} /> : null}
        <Pressable testID={`home-recommendation-${suggestion.id}`} accessibilityRole="button"
        accessibilityLabel={`${suggestion.label}. ${suggestion.basis === 'source-popular' ? 'Popular on the published menu' : 'Recently verified nearby'}`}
        onPress={() => suggestion.offer ? openOffer(suggestion.offer) : router.push(suggestion.href as never)}
        style={({ pressed }) => ({ minHeight: 44, maxWidth: 230, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? .6 : 1 })}>
        <Text numberOfLines={1} className="font-dm" style={{ flexShrink: 1, fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{suggestion.label}</Text>
      </Pressable></View>)}
    </ScrollView> : <Text testID="home-recommendations-empty" className="font-dm" style={{ paddingVertical: 13, fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>Fresh local picks are on the way.</Text>}
  </View>;
}

export function PerksHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const colors = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 11 }}>
    <Text accessibilityRole="header" className="font-fraunces text-ink" style={{ fontSize: 22, lineHeight: 27, letterSpacing: -.45, flex: 1 }}>{title}</Text>
    {action && onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${action} ${title.toLowerCase()}`} onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 28 }}>
      <Text className="font-dm text-fine text-peach">{action}</Text><Glyph name="chevron" size={13} color={colors['fg-accent']} />
    </Pressable> : null}
  </View>;
}

/** The complete promo, including image, is a 110px ribbon rather than a hero.
 * Preserve the visible slide across source refreshes, including during a swipe. */
export function LocalPerksBanners({ catalog, compact = false }: { catalog: HomeGuideCatalog; compact?: boolean }) {
  const colors = useThemeColors(), router = useRouter(), openStay = useScoper(s => s.openStaySheet), openOffer = useLocalPerks(s => s.openOffer);
  const now = useNow(), reduced = useReducedMotionPreference();
  const offers = localOffers(catalog, now), slides = [...offers.slice(0, 3).map(offer => ({ id: offer.id, offer })), { id: 'vee', offer: undefined }, { id: 'stay', offer: undefined }];
  const ref = useRef<ScrollView>(null), [width, setWidth] = useState(300), [selectedId, setSelectedId] = useState(slides[0].id);
  const stride = width + 12;
  const selected = useRef(selectedId), dragging = useRef(false), idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAlignment = useRef(false), lastSwipe = useRef(0);
  const idsKey = JSON.stringify(slides.map(slide => slide.id)), current = bannerPageForId(slides.map(slide => slide.id), selectedId), height = compact ? 100 : 110;
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
        const offer = slide.offer, copy = offer ? compactOffer(offer) : slide.id === 'vee' ? { title: 'Your evening, with Vee', detail: 'A table. A little music. Your kind of night.' } : { title: 'Stay here. Go somewhere.', detail: 'Your stay, a little more city.' };
        const entry = offer ? catalog.entries[offer.venueKey] : undefined;
        return <Pressable key={slide.id} testID={`perks-banner-${offer ? 'offer' : slide.id}`} accessibilityRole="button"
          accessibilityLabel={offer ? `${offer.venue}. ${offer.title}. ${offer.label}. View offer` : copy.title}
          onPress={() => { if (dragging.current || Date.now() - lastSwipe.current < 250) return; if (offer) openOffer(offer); else if (slide.id === 'vee') router.push('/create'); else openStay(); }}
          style={({ pressed }) => ({ width, height, flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors['edge-card'], backgroundColor: colors['surface-ribbon'], opacity: pressed ? .78 : 1 })}>
          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 13, paddingVertical: 10, justifyContent: 'center', gap: 3 }}>
            <Text numberOfLines={1} className="font-dm" style={{ fontSize: 9.5, lineHeight: 13, letterSpacing: .5, textTransform: 'uppercase', color: colors['ribbon-ink'] }}>{offer ? offer.venue + ' · Venue-listed offer' : slide.id === 'vee' ? 'A little more city' : 'Your home base'}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.85} className="font-fraunces" style={{ fontSize: 22, lineHeight: 26, letterSpacing: -.5, color: colors['ribbon-ink'] }}>{copy.title}</Text>
            <Text numberOfLines={1} className="font-dm" style={{ fontSize: 11, lineHeight: 15, color: colors['ribbon-ink'] }}>{copy.detail}</Text>
            <Text className="font-dm-medium" style={{ fontSize: 10, lineHeight: 14, color: colors['ribbon-ink'] }}>{offer ? 'See offer' : slide.id === 'vee' ? 'Make an evening' : 'Link your stay'}</Text>
          </View>
          {offer ? <PerksPhoto entry={entry} catalog={catalog} width={78} height={height} radius={0} /> : <View style={{ width: 65, alignItems: 'center', justifyContent: 'center' }}>{slide.id === 'vee' ? <VeeMark size={48} /> : <Glyph name="briefcase" size={29} color={colors['ribbon-ink']} strokeWidth={1.4} />}</View>}
        </Pressable>;
      })}
    </ScrollView>
    <View testID="perks-banner-position" accessible accessibilityRole="adjustable" accessibilityLabel="Promotions" accessibilityValue={{ min: 1, max: slides.length, now: current + 1, text: `Banner ${current + 1} of ${slides.length}` }}
      aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={current + 1} aria-valuetext={`Banner ${current + 1} of ${slides.length}`}
      accessibilityActions={[{ name: 'increment', label: 'Next banner' }, { name: 'decrement', label: 'Previous banner' }]}
      onAccessibilityAction={event => step(current + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, height: 13 }}>
      {slides.map((slide, i) => <View key={slide.id} accessible={false} style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors['fg-muted'], opacity: current === i ? .55 : .18 }} />)}
    </View>
  </View>;
}

export function LocalPerksCard({ entry, catalog, format = 'row', width, photos, onOpen, onPhotoUnavailable }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; format?: 'row' | 'rail' | 'wide'; width?: number; photos?: readonly HomeIndexPhoto[]; onOpen?: () => void; onPhotoUnavailable?: () => void }) {
  const colors = useThemeColors(), surface = useRaisedSurface(1), router = useRouter(), activeCity = useActiveCity(), s = useScoper(), perks = useLocalPerks(), city = perksAreaKey(activeCity, s.deviceLocation);
  const rail = format !== 'row', key = eveningStopKey(entry);
  const added = perks.date === todayIso() && perks.stops.some(stop => stop.city === city && eveningStopKey(stop) === key);
  const saved = entry.saveKind ? s.isSaved(entry.saveKind, entry.id) : entry.planKind ? s.isPlanned(entry.planKind, entry.id) : false;
  const canSave = Boolean(entry.saveKind || entry.planKind), menuCount = entry.detailContent?.menu?.items.length;
  const facts = entry.facts.filter(fact => ['wallet', 'dollar', 'pin', 'clock', 'calendar', 'walk', 'route', 'car'].includes(fact.glyph)).slice(0, 2);
  const save = () => { if (entry.saveKind) s.toggleSaved(entry.saveKind, entry.id, entry.name); else if (entry.planKind) s.togglePlan(entry.planKind, entry.id, entry.name); };
  const add = () => {
    if (!added && perks.stops.filter(stop => stop.city === city).length >= MAX_EVENING_STOPS && perks.date === todayIso()) { s.showToast('Keep up to eight stops in an evening.'); return; }
    perks.toggleStop({ kind: entry.kind, id: entry.id, city, name: entry.name, caption: entry.caption, image: entry.image, glyph: entry.glyph, facts: entry.facts });
    s.showToast(added ? 'A little room for something else.' : 'One good stop, kept in mind.');
  };
  return <View testID="local-perks-card" style={[surface, { width, borderRadius: 18, overflow: 'hidden', flexShrink: 0 }]}>
    <Pressable testID="perks-place-open" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${entry.caption}`} onPress={onOpen || (() => router.push(homeGuideHref(entry) as never))}
      style={({ pressed }) => ({ flexDirection: rail ? 'column' : 'row', gap: rail ? 0 : 11, padding: rail ? 10 : 9, opacity: pressed ? .78 : 1, alignItems: rail ? 'stretch' : 'center', minHeight: rail ? undefined : 100 })}>
      <PerksPhoto key={key} entry={entry} catalog={catalog} photos={photos} height={rail ? 132 : 80} width={rail ? undefined : 80} onUnavailable={onPhotoUnavailable} />
      <View style={{ flex: 1, minWidth: 0, paddingTop: rail ? 10 : 0, paddingRight: rail ? 34 : 28, paddingBottom: rail ? 4 : 0, gap: 5 }}>
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-fraunces text-ink" style={{ fontSize: 20, lineHeight: 24, letterSpacing: -.35 }}>{brief(entry.name)}</Text>
        <Text numberOfLines={1} className="font-dm text-fine text-taupe">{entry.caption}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 17 }}>
          {facts.map((fact, index) => <View key={index} accessibilityLabel={fact.label || fact.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1, minWidth: 0 }}>
            {!['wallet', 'dollar'].includes(fact.glyph) ? <Glyph name={fact.glyph} size={11} color={colors['fg-muted']} /> : null}
            <Text numberOfLines={1} className="font-dm text-fine text-taupe" style={{ flexShrink: 1 }}>{fact.value}</Text>
          </View>)}
          {menuCount && facts.length < 2 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Glyph name="book" size={11} color={colors['fg-muted']} /><Text className="font-dm text-fine text-taupe">Menu</Text></View> : null}
        </View>
      </View>
    </Pressable>
    {canSave ? <Pressable testID="perks-save-place" accessibilityRole="button" accessibilityLabel={`${saved ? 'Unsave' : 'Save'} ${entry.name}`} accessibilityState={{ selected: saved }} onPress={save} hitSlop={5}
      style={({ pressed }) => ({ position: 'absolute', top: 11, right: 11, width: 30, height: 30, borderRadius: 15, backgroundColor: colors['surface-control'], borderWidth: 1, borderColor: colors['edge-card'], alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><Glyph name={saved ? 'check' : 'heart'} size={16} color={saved ? colors['accent-fill'] : colors.fg} /></Pressable> : null}
    <Pressable testID="perks-add-stop" accessibilityRole="button" accessibilityLabel={`${added ? 'Remove' : 'Add'} ${entry.name} ${added ? 'from' : 'to'} your evening`} accessibilityState={{ selected: added }} onPress={add} hitSlop={5}
      style={({ pressed }) => ({ position: 'absolute', bottom: 10, right: 11, width: 28, height: 28, borderRadius: 14, backgroundColor: added ? colors['accent-tint'] : colors['surface-control'], borderWidth: 1, borderColor: colors['control-edge'], alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><Glyph name={added ? 'check' : 'plus'} size={14} color={colors['fg-accent']} /></Pressable>
  </View>;
}

export function PerksVeeRibbon() {
  const router = useRouter(), colors = useThemeColors();
  return <Pressable testID="home-evening-ribbon" accessibilityRole="button" accessibilityLabel="Let Vee find your kind of night" onPress={() => router.push('/create')}
    style={({ pressed }) => ({ minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 17, borderWidth: 1, borderColor: colors['edge-card'], backgroundColor: colors['surface-ribbon'], paddingHorizontal: 12, opacity: pressed ? .76 : 1 })}>
    <VeeMark size={28} /><Text className="font-dm text-label" style={{ flex: 1, color: colors['ribbon-ink'] }}>Let Vee find your kind of night.</Text><Glyph name="chevron" size={15} color={colors['ribbon-ink']} />
  </Pressable>;
}

export function PerksRail({ entries, catalog }: { entries: readonly HomeGuideEntry[]; catalog: HomeGuideCatalog }) {
  const [width, setWidth] = useState(310), cardWidth = Math.min(340, width * .82);
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
