import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuroraGlow, GradientFill, GradientText } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { AppBackdrop } from '@/components/layout';
import { BayConstellation, HappyHourClock, NearbyRings, NightRoute, StoryOrbs, WeekLine } from '@/components/onboarding-art';
import { AuthForm } from '@/components/overlays';
import { GoogleLogo } from '@/components/ui';
import { WalkSlider } from '@/components/walk-slider';
import type { TripContext, WalkBudget } from '@/lib/arrival';
import { useAurora } from '@/lib/aurora';
import { switchCity } from '@/lib/bootstrap';
import { useActiveCity, useActiveCityName, useCityOptions } from '@/lib/city';
import { milesBetween } from '@/lib/geo';
import { NO_RESTRICTIONS, OTHER_RESTRICTION, togglePlanAroundChip } from '@/lib/plan-around';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';
import { HEADING_FONT, headingStyle } from '@/lib/typography';

/* Arrival, in two parts.
 *
 * ArrivalStory is full-screen: four short cards about what Wayvee is (the
 * whole Bay; dates checked against official listings; deals straight from
 * venues; Vee), the way in (Google, email, or explore first), then a location
 * ask in context, before the system's own prompt.
 *
 * QuickSetupSheet then rises over Home itself, blurred behind it: what brings
 * you here, what you're into, how far you'll walk, what to plan around. It
 * replaces the old four-step questionnaire, and every answer it shows is what
 * gets stored. */

// ── Shared pieces ───────────────────────────────────────────────────────────

/** Bold Outfit with one italic Fraunces word in the Aurora gradient. */
function StoryHeadline({ main, accent, size = 38 }: { main: string; accent: string; size?: number }) {
  return (
    <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: size, lineHeight: size + 4, letterSpacing: size > 32 ? -1.4 : -1 }}>
      {main}
      <Text style={{ fontFamily: HEADING_FONT, letterSpacing: -0.6 }}><GradientText text={accent} /></Text>
    </Text>
  );
}

function PrimaryButton({ label, onPress, busy = false, testID, style }: { label: string; onPress: () => void; busy?: boolean; testID?: string; style?: StyleProp<ViewStyle> }) {
  const aurora = useAurora();
  return (
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} disabled={busy} activeOpacity={0.85} onPress={onPress}
      style={[{ height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -12px rgba(106, 74, 201, 0.55)' }, style]}>
      <GradientFill radius={27} />
      {busy ? <ActivityIndicator color={aurora.onFill} /> : <Text className="font-dm-bold" style={{ fontSize: 16, lineHeight: 20, color: aurora.onFill }}>{label}</Text>}
    </TouchableOpacity>
  );
}

function QuietButton({ label, onPress, icon, busy = false, testID }: { label: string; onPress: () => void; icon?: ReactNode; busy?: boolean; testID?: string }) {
  const colors = useThemeColors(), aurora = useAurora();
  return (
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} disabled={busy} activeOpacity={0.8} onPress={onPress}
      style={{ height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors['surface-raised'], borderWidth: 1, borderColor: aurora.glassEdge, boxShadow: aurora.shadow }}>
      {busy ? <ActivityIndicator color={colors.fg} /> : icon}
      <Text className="font-dm-medium text-ink" style={{ fontSize: 16, lineHeight: 20 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function TextLink({ label, onPress, testID, height = 40 }: { label: string; onPress: () => void; testID?: string; height?: number }) {
  return (
    <TouchableOpacity testID={testID} accessibilityRole="button" activeOpacity={0.7} onPress={onPress} style={{ height, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
      <Text className="font-dm-medium text-peach" style={{ fontSize: 15, lineHeight: 20 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Dots({ at, count }: { at: number; count: number }) {
  const colors = useThemeColors();
  return (
    <View accessibilityLabel={`Step ${at + 1} of ${count}`} style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      {Array.from({ length: count }, (_, i) => i === at
        ? <View key={i} style={{ width: 22, height: 7, borderRadius: 4, overflow: 'hidden' }}><GradientFill radius={4} /></View>
        : <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors['fg-muted'], opacity: 0.35 }} />)}
    </View>
  );
}

function TopBar({ onBack, onSignIn }: { onBack?: () => void; onSignIn?: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={{ height: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {onBack ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} activeOpacity={0.7} onPress={onBack} style={{ width: 36, height: 36, justifyContent: 'center' }}>
          <Glyph name="chevronLeft" size={22} color={colors.fg} strokeWidth={2} />
        </TouchableOpacity>
      ) : <View style={{ width: 36 }} />}
      {onSignIn ? <TextLink testID="arrival-sign-in" label="Sign in" onPress={onSignIn} /> : null}
    </View>
  );
}

/** A soft entrance for each card: fade up a few points. */
function StepFade({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(10));
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, rise]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY: rise }] }]}>{children}</Animated.View>;
}

// ── The story ───────────────────────────────────────────────────────────────

const CARDS = ['bay', 'shows', 'deals', 'vee'] as const;
type Card = (typeof CARDS)[number];
type StoryStep = Card | 'account' | 'location';

const COPY: Record<Card | 'location', { main: string; accent: string; sub: string; lights: (0 | 1 | 2)[] }> = {
  bay: { main: 'The whole ', accent: 'Bay.', sub: 'Eight cities, one honest guide.', lights: [0, 1, 2] },
  shows: { main: 'Every date, ', accent: 'checked.', sub: 'Pulled from official listings, so tonight means tonight.', lights: [1, 2, 0] },
  deals: { main: 'Deals that are\n', accent: 'actually on.', sub: 'Straight from the venues. Tagged Today only when it’s true.', lights: [2, 0, 1] },
  vee: { main: 'Then, let ', accent: 'Vee.', sub: 'Say the vibe. Get the whole night.', lights: [0, 1] },
  location: { main: 'Mind if Vee\n', accent: 'tags along?', sub: 'Location turns “nearby” into minutes. Only while you’re using Wayvee.', lights: [1, 0] },
};

function StoryArt({ step }: { step: Card | 'location' }) {
  if (step === 'bay') return <BayConstellation />;
  if (step === 'shows') return <WeekLine />;
  if (step === 'deals') return <HappyHourClock />;
  if (step === 'vee') return <NightRoute />;
  return <NearbyRings />;
}

/** Room for the tallest footer (the way in), held on every card so the art
 * and headline stay put as the guest pages through. */
const FOOTER_HEIGHT = 184;

export function ArrivalStory({ onSetup }: { onSetup: () => void }) {
  const session = useScoper(s => s.session);
  const signInWithGoogle = useScoper(s => s.signInWithGoogle);
  const requestLocation = useScoper(s => s.requestLocation);
  const skipLocation = useScoper(s => s.skipLocation);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [step, setStep] = useState<StoryStep>('bay');
  const [history, setHistory] = useState<StoryStep[]>([]);
  const [accountMode, setAccountMode] = useState<'sign-in' | 'create'>('create');
  const [busy, setBusy] = useState<'google' | 'location' | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Signed in by any route (Google here, email in the account step, or a web
  // redirect that reloaded the app): the next thing to ask is location.
  const current: StoryStep = session ? 'location' : step;
  const cardIndex = CARDS.indexOf(current as Card);

  const go = (next: StoryStep) => {
    setHistory([...history, current]);
    setStep(next);
  };
  const back = () => {
    const previous = history[history.length - 1];
    if (!previous || session) return false;
    setHistory(history.slice(0, -1));
    setStep(previous);
    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', back);
    return () => subscription.remove();
  });

  const swipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => cardIndex >= 0 && Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -44 && cardIndex < CARDS.length - 1) go(CARDS[cardIndex + 1]);
      else if (gesture.dx > 44 && cardIndex > 0) back();
    },
  });

  const google = async () => {
    setGoogleError(null);
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (caught) {
      setGoogleError(caught instanceof Error ? caught.message : 'Google sign-in did not finish.');
    } finally {
      setBusy(null);
    }
  };

  const shareLocation = async () => {
    setBusy('location');
    try {
      await requestLocation();
    } catch {
      // A failed fix is the same as no fix: setup asks where in the Bay instead.
    }
    onSetup();
  };

  const notNow = async () => {
    try {
      await skipLocation();
    } catch {
      // Not being asked again is a convenience; moving on is what matters.
    }
    onSetup();
  };

  const openAccount = (mode: 'sign-in' | 'create') => {
    setAccountMode(mode);
    go('account');
  };

  if (current === 'account') {
    return (
      <AppBackdrop>
        <AuroraGlow height={windowHeight} />
        <View style={{ paddingTop: insets.top }}><TopBar onBack={back} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: insets.bottom + 28 }}>
          <StepFade key={accountMode}><AuthForm titleVariant="page" initialMode={accountMode} /></StepFade>
        </ScrollView>
      </AppBackdrop>
    );
  }

  const copy = COPY[current];
  const canGoBack = history.length > 0 && !session;

  return (
    <AppBackdrop>
      <AuroraGlow height={windowHeight} />
      <View testID={`arrival-${current}`} style={{ flex: 1, paddingTop: insets.top }} {...swipe.panHandlers}>
        <TopBar onBack={canGoBack ? back : undefined} onSignIn={cardIndex >= 0 && cardIndex < 3 ? () => openAccount('sign-in') : undefined} />
        <View style={{ flex: 1, minHeight: 180 }}>
          <StoryOrbs lights={copy.lights} />
          <StepFade key={current} style={{ flex: 1, paddingVertical: 6 }}><StoryArt step={current} /></StepFade>
        </View>
        <StepFade key={current + '-copy'} style={{ paddingHorizontal: 28, minHeight: 148 }}>
          <StoryHeadline main={copy.main} accent={copy.accent} />
          <Text className="font-dm text-taupe" style={{ fontSize: 16, lineHeight: 23, marginTop: 10, maxWidth: 310 }}>{copy.sub}</Text>
        </StepFade>
        <View style={{ minHeight: FOOTER_HEIGHT + insets.bottom + 18, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: insets.bottom + 18 }}>
          {current === 'vee' ? (
            <>
              <View style={{ gap: 10 }}>
                <QuietButton testID="arrival-google" label="Continue with Google" icon={<GoogleLogo size={19} />} busy={busy === 'google'} onPress={google} />
                <PrimaryButton testID="arrival-email" label="Sign up with email" onPress={() => openAccount('create')} />
                <TextLink testID="arrival-explore" label="Explore first" onPress={() => go('location')} />
              </View>
              {googleError ? <Text accessibilityLiveRegion="polite" className="font-dm text-peach" style={{ fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginBottom: 6 }}>{googleError}</Text> : null}
              <View style={{ marginTop: 6 }}><Dots at={3} count={4} /></View>
            </>
          ) : current === 'location' ? (
            <View style={{ gap: 10 }}>
              <PrimaryButton testID="arrival-share-location" label="Share location" busy={busy === 'location'} onPress={shareLocation} />
              <TextLink testID="arrival-not-now" label="Not now" onPress={notNow} />
            </View>
          ) : (
            <>
              <View style={{ marginBottom: 18 }}><Dots at={cardIndex} count={4} /></View>
              <PrimaryButton testID="arrival-next" label="Next" onPress={() => go(CARDS[cardIndex + 1])} />
            </>
          )}
        </View>
      </View>
    </AppBackdrop>
  );
}

// ── Quick setup ─────────────────────────────────────────────────────────────

/** The six interests. `tags` is what each writes into the taste profile — the
 * ranker only sees vocabulary the catalog carries, so a chip can never
 * promise a category the catalog can't answer. Picking one steers the mix;
 * it never promises a listing that doesn't exist. */
const INTERESTS: { id: string; label: string; tags: string[]; glyph: string }[] = [
  { id: 'food', label: 'Food', tags: ['Restaurants'], glyph: 'food' },
  { id: 'music', label: 'Live music', tags: ['Live music'], glyph: 'music' },
  { id: 'outdoors', label: 'Outdoors', tags: ['Outdoor'], glyph: 'hike' },
  { id: 'fitness', label: 'Fitness', tags: ['Fitness'], glyph: 'fitness' },
  { id: 'drinks', label: 'Drinks', tags: ['Nightlife'], glyph: 'drink' },
  { id: 'art', label: 'Art & film', tags: ['Movies'], glyph: 'film' },
];

const HERE_FOR: { value: TripContext; label: string; glyph: string }[] = [
  { value: 'visiting', label: 'A visit', glyph: 'luggage' },
  { value: 'work', label: 'Work', glyph: 'briefcase' },
  { value: 'live', label: 'I live here', glyph: 'home' },
];

/** The plan-around chips shown here; the rest stay a tap away in You. */
const PLAN_AROUND_SHOWN = [NO_RESTRICTIONS, 'Vegetarian', 'Vegan', 'Gluten-free', 'Halal', 'Wheelchair access', 'Low-noise'];

/** How far a launched city's centre can be and still count as "here". */
const NEARBY_CITY_MILES = 40;

function SectionLabel({ text, first = false }: { text: string; first?: boolean }) {
  return <Text accessibilityRole="header" className="text-ink" style={[headingStyle(19), { marginTop: first ? 16 : 20, marginBottom: 10 }]}>{text}</Text>;
}

function SubLabel({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return <View style={style}><Text className="font-dm-bold text-taupe" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 1.4 }}>{text.toUpperCase()}</Text></View>;
}

function Chip({ label, glyph, selected, onPress, role = 'checkbox' }: { label: string; glyph?: string; selected: boolean; onPress: () => void; role?: 'checkbox' | 'radio' }) {
  const colors = useThemeColors(), aurora = useAurora(), ink = colors['pill-ink'];
  return (
    <TouchableOpacity accessibilityRole={role} accessibilityState={role === 'radio' ? { selected } : { checked: selected }} accessibilityLabel={label} activeOpacity={0.78} onPress={onPress}
      style={{ height: 38, paddingHorizontal: 13, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: selected ? colors['accent-tint'] : colors['surface-raised'], borderWidth: selected ? 1.5 : 1, borderColor: selected ? `${ink}73` : aurora.glassEdge }}>
      {glyph ? <Glyph name={glyph} size={15} color={selected ? ink : colors.accent} strokeWidth={1.9} /> : null}
      <Text className="font-dm-medium" style={{ fontSize: 14, lineHeight: 18, color: selected ? ink : colors['fg-muted'] }}>{label}</Text>
      {selected ? <Glyph name="check" size={14} color={ink} strokeWidth={2.4} /> : null}
    </TouchableOpacity>
  );
}

function HereFor({ value, onChange }: { value: TripContext; onChange: (value: TripContext) => void }) {
  const colors = useThemeColors(), aurora = useAurora();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 4, borderRadius: 23, backgroundColor: colors['surface-sunk'], borderWidth: 1, borderColor: aurora.glassEdge }}>
      {HERE_FOR.map(option => {
        const selected = option.value === value, ink = selected ? aurora.onFill : colors['fg-muted'];
        return (
          <TouchableOpacity key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.label} activeOpacity={0.8} onPress={() => onChange(option.value)}
            style={{ flex: 1, height: 38, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {selected ? <GradientFill radius={19} /> : null}
            <Glyph name={option.glyph} size={15} color={ink} strokeWidth={1.9} />
            <Text numberOfLines={1} className="font-dm-medium" style={{ fontSize: 14, lineHeight: 18, color: ink }}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function QuickSetupSheet({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors(), aurora = useAurora(), insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const storedTripContext = useScoper(s => s.tripContext);
  const storedWalkBudget = useScoper(s => s.walkBudgetMinutes);
  const storedPlanAround = useScoper(s => s.planAround);
  const locationStatus = useScoper(s => s.locationStatus);
  const deviceLocation = useScoper(s => s.deviceLocation);
  const setTasteTags = useScoper(s => s.setTasteTags);
  const setTripContext = useScoper(s => s.setTripContext);
  const setWalkBudgetMinutes = useScoper(s => s.setWalkBudgetMinutes);
  const setPlanAround = useScoper(s => s.setPlanAround);
  const resolveTastePrompt = useScoper(s => s.resolveTastePrompt);
  const cities = useCityOptions(), activeSlug = useActiveCity(), cityName = useActiveCityName();

  const [hereFor, setHereFor] = useState<TripContext>(storedTripContext ?? 'visiting');
  const [interests, setInterests] = useState<string[]>(['food', 'music', 'outdoors']);
  const [walkBudget, setWalkBudget] = useState<WalkBudget>(storedWalkBudget ?? 20);
  const [chips, setChips] = useState<string[]>(storedPlanAround.chips.length ? storedPlanAround.chips : [NO_RESTRICTIONS]);
  const [veil] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(windowHeight));
  const closing = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(veil, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, damping: 22, stiffness: 180, mass: 0.9, useNativeDriver: true }),
    ]).start();
  }, [veil, rise]);

  // With a fix, settle on the nearest launched city so "Using your location"
  // names the right one. Without one, the guest picks below.
  const located = locationStatus === 'granted' && deviceLocation !== null;
  useEffect(() => {
    if (locationStatus !== 'granted' || !deviceLocation) return;
    const nearest = cities
      .filter(city => city.anchor)
      .map(city => ({ slug: city.slug, miles: milesBetween(deviceLocation, city.anchor!) }))
      .sort((a, b) => a.miles - b.miles)[0];
    if (nearest && nearest.slug !== activeSlug && nearest.miles <= NEARBY_CITY_MILES) void switchCity(nearest.slug).catch(() => undefined);
  }, [locationStatus, deviceLocation, cities, activeSlug]);

  const close = (save: boolean) => {
    if (closing.current) return;
    closing.current = true;
    if (save) {
      // Everything on the sheet is stored, touched or not: a guest who accepts
      // the defaults has still just read them as Wayvee's understanding.
      setTripContext(hereFor);
      setWalkBudgetMinutes(walkBudget);
      setTasteTags(INTERESTS.filter(item => interests.includes(item.id)).flatMap(item => item.tags));
      setPlanAround({ chips, note: chips.includes(OTHER_RESTRICTION) ? storedPlanAround.note : '' });
      void resolveTastePrompt(interests.length > 0 ? 'done' : 'skipped');
    } else {
      void resolveTastePrompt('skipped');
    }
    Animated.parallel([
      Animated.timing(veil, { toValue: 0, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(rise, { toValue: windowHeight, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onDone());
  };

  const toggleInterest = (id: string) => setInterests(interests.includes(id) ? interests.filter(value => value !== id) : [...interests, id]);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 15 }]}>
      <Animated.View testID="setup-veil" style={[StyleSheet.absoluteFill, { backgroundColor: aurora.veil, opacity: veil }]} />
      <Animated.View testID="quick-setup" accessibilityViewIsModal
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: windowHeight - insets.top - 20, backgroundColor: colors.bg,
          borderTopLeftRadius: 30, borderTopRightRadius: 30, boxShadow: '0 -20px 50px -20px rgba(20, 10, 40, 0.45)', transform: [{ translateY: rise }] }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors['fg-muted'], opacity: 0.35, alignSelf: 'center', marginTop: 10 }} />
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 6 }}>
          <StoryHeadline main="Quick " accent="setup." size={30} />

          {located ? (
            <View testID="setup-located" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, marginTop: 12, backgroundColor: colors['accent-tint'] }}>
              <Glyph name="navigation" size={13} color={colors['pill-ink']} strokeWidth={2} />
              <Text className="font-dm-bold" style={{ fontSize: 12.5, lineHeight: 16, color: colors['pill-ink'] }}>Using your location · {cityName}</Text>
            </View>
          ) : (
            <>
              <SectionLabel text="Where in the Bay?" first />
              <View testID="setup-cities" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {cities.map(city => <Chip key={city.slug} role="radio" label={city.name} glyph="pin" selected={city.slug === activeSlug} onPress={() => void switchCity(city.slug).catch(() => undefined)} />)}
              </View>
            </>
          )}

          <SectionLabel text="Here for" />
          <HereFor value={hereFor} onChange={setHereFor} />

          <SectionLabel text="Into" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTERESTS.map(item => <Chip key={item.id} label={item.label} glyph={item.glyph} selected={interests.includes(item.id)} onPress={() => toggleInterest(item.id)} />)}
          </View>

          <SectionLabel text="Preferences" />
          <SubLabel text="Walk up to" />
          <WalkSlider value={walkBudget} onChange={setWalkBudget} />
          <SubLabel text="Plan around" style={{ marginTop: 26, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PLAN_AROUND_SHOWN.map(chip => <Chip key={chip} label={chip} selected={chips.includes(chip)} onPress={() => setChips(togglePlanAroundChip(chips, chip))} />)}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 14, paddingBottom: insets.bottom + 16 }}>
          <TextLink testID="setup-skip" label="Skip" height={54} onPress={() => close(false)} />
          <PrimaryButton testID="setup-done" label="Show me the Bay" style={{ flex: 1 }} onPress={() => close(true)} />
        </View>
      </Animated.View>
    </View>
  );
}
