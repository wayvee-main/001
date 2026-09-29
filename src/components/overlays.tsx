import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, type DateData } from 'react-native-calendars';

import { AskVeeRow } from '@/components/ask-vee-row';
import { Field } from '@/components/onboarding';
import { WayveeWordmark } from '@/components/wayvee-wordmark';
import { RaisedTouchable, RaisedView } from '@/components/raised-surface';
import { ChevronRight, GoogleLogo, OptionPill, SearchIcon } from '@/components/ui';
import { isAccountAuthConfigured } from '@/lib/auth';
import { buildPlan, mergeRefineRequest, resolveAskNow } from '@/lib/concierge/adapter';
import { requestConciergeRequest } from '@/lib/concierge/client';
import { applyFreshness, readSyncStatus } from '@/lib/concierge/freshness';
import { conciergeDeclined } from '@/lib/concierge/request';
import { routeForRequest } from '@/lib/concierge/router';
import {
  EVENTS,
  GUEST,
  RESTAURANTS,
  currentEventListings,
  isCurrentEvent,
  parseTimeToMinutes,
  type HomeActionLink,
} from '@/lib/data';
import { homeActionLinks } from '@/lib/daypart';
import { loadDinnerHistory } from '@/lib/dinner-history';
import { canonicalRestaurantHref, recordRestaurantExploration } from '@/lib/exploration-history';
import { doorDashLink, lyftRideLink, streetAddress, uberEatsLink, uberRideLink } from '@/lib/links';
import { useOnlineStatus } from '@/lib/network';
import { START_TIME_OPTIONS } from '@/lib/plan-constraints';
import { useAllPlaces, useCuratedCoords, useCuratedHours } from '@/lib/places';
import { buildSearchIndex, buildVocabulary, queryIndex, suggestFor, SEARCH_KIND_LABELS, type SearchResult, type SearchResultKind } from '@/lib/search';
import { clearRecentSearches, loadRecentSearches, recordRecentSearch, type RecentSearch } from '@/lib/recent-searches';
import { addDaysIso, nightsBetween, parseDateOnly, stayNightDates, todayIso } from '@/lib/stay';
import { useScoper } from '@/lib/store';
import { tasteVocabulary } from '@/lib/taste';
import { useThemeColors } from '@/lib/theme';
import { useViatorPicks } from '@/lib/viator';
import type { VisitRating } from '@/lib/visit-feedback';
import { useWeatherNow } from '@/lib/weather';

// ── Offline banner ──────────────────────────────────────────────────────────

export function OfflineBanner() {
  const online = useOnlineStatus();
  const insets = useSafeAreaInsets();
  if (online) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top, left: 0, right: 0, zIndex: 40, alignItems: 'center' }}>
      <RaisedView className="mt-2 rounded-full px-4 py-2">
        <Text className="font-dm-medium text-label text-taupe">You’re offline — showing what’s already loaded</Text>
      </RaisedView>
    </View>
  );
}

// ── Toast ───────────────────────────────────────────────────────────────────

export function Toast() {
  const toast = useScoper((s) => s.toast);
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (toast) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    }
  }, [toast, anim]);

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 108,
        left: 24,
        right: 24,
        alignItems: 'center',
        zIndex: 50,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}>
      <View className="rounded-full border border-sand bg-coral-50 px-[18px] py-[11px]" style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}>
        <Text className="font-dm text-[13px] text-ink" numberOfLines={1}>
          {toast}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Sheet scaffolding ───────────────────────────────────────────────────────

function useAndroidBack(onBack: () => void) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
}

/** How far a bottom-anchored sheet must rise to clear the keyboard, as an
 * animated value. Derived from the keyboard's top edge against the window
 * height rather than raw keyboard height, so it self-corrects where the window
 * already resizes under the keyboard (Android `resize` mode) and the overlap
 * comes out as zero — a raw-height shift would double-count there. */
function useKeyboardShift(bottomInset: number) {
  const { height: windowHeight } = useWindowDimensions();
  const [shift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // iOS gets a `will` event with a duration, so the sheet moves in lockstep
    // with the keyboard. Android only fires `did`, after the fact.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animate = (toValue: number, duration?: number) => {
      Animated.timing(shift, {
        toValue,
        duration: duration || 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    };

    const onShow = (e: KeyboardEvent) => {
      // The sheet already pads for the bottom safe area, and that strip sits
      // behind the keyboard once it's up — don't reserve space for it twice.
      animate(Math.max(0, windowHeight - e.endCoordinates.screenY - bottomInset), e.duration);
    };

    const subs = [
      Keyboard.addListener(showEvent, onShow),
      Keyboard.addListener(hideEvent, (e: KeyboardEvent) => animate(0, e.duration)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [shift, windowHeight, bottomInset]);

  return shift;
}

function SheetBase({ children, scrollable = false }: { children: ReactNode; scrollable?: boolean }) {
  const closeSheet = useScoper((s) => s.closeSheet);
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  const keyboardShift = useKeyboardShift(insets.bottom);

  useAndroidBack(closeSheet);
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [anim]);

  const body = (
    <>
      <View className="mb-3.5 mt-0.5 h-1 w-9 self-center rounded-full bg-sand" />
      {children}
    </>
  );

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: anim }}>
        <Pressable onPress={closeSheet} style={{ flex: 1, backgroundColor: 'rgba(43,33,24,0.42)' }} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '85%',
          alignItems: 'center',
          transform: [
            {
              translateY: Animated.subtract(
                anim.interpolate({ inputRange: [0, 1], outputRange: [640, 0] }),
                keyboardShift,
              ),
            },
          ],
        }}>
        <View
          style={{ width: '100%', maxWidth: 720, maxHeight: '100%', paddingBottom: 28 + insets.bottom }}
          className="rounded-t-sheet bg-shell pt-2.5">
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              // Without this the first tap while the keyboard is up is spent
              // dismissing it instead of hitting the button/date underneath.
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20 }}>
              {body}
            </ScrollView>
          ) : (
            <View className="px-5">{body}</View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

function SheetTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <>
      <View className="flex-row items-center justify-between">
        <Text className="font-fraunces text-[18px] text-ink">{title}</Text>
        {action}
      </View>
      {sub ? <Text className="mt-0.5 font-dm text-label text-taupe">{sub}</Text> : null}
    </>
  );
}

/** Provider row that opens a real link on tap — no in-app "booking" state to fake. */
function LinkRow({
  onPress,
  left,
  badge,
  right,
}: {
  onPress: () => void;
  left: string;
  badge?: ReactNode;
  right: ReactNode;
}) {
  return (
    <RaisedTouchable
      activeOpacity={0.7}
      onPress={onPress}
      className="flex-row items-center justify-between rounded-card px-3.5 py-[13px]">
      <View className="flex-row items-center gap-x-2">
        <Text className="font-dm-medium text-[14px] text-ink">{left}</Text>
        {badge}
      </View>
      <View className="flex-row items-center gap-x-2">
        {right}
        <ChevronRight />
      </View>
    </RaisedTouchable>
  );
}

// ── Delivery sheet ──────────────────────────────────────────────────────────

function providerFallbackLink(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes('doordash')) return doorDashLink();
  return uberEatsLink();
}

/** No forced upsell if the guest already has something lined up. */
function hasCurrentPlan(plans: string[]): boolean {
  return plans.some((eventId) => {
    const event = EVENTS[eventId];
    return event && isCurrentEvent(event);
  });
}

function DeliverySheet() {
  const { deliveryFor, closeSheet, plans, showToast } = useScoper();
  const restaurant = deliveryFor ? RESTAURANTS[deliveryFor] : null;
  const quotes = restaurant?.delivery ?? [];

  const openProvider = (provider: string, url?: string) => {
    Linking.openURL(url ?? providerFallbackLink(provider))
      .then(() => {
        if (!hasCurrentPlan(plans)) showToast('Ordering? Check Discover for something to catch tonight');
      })
      .catch(() => showToast('Could not open that link'));
    closeSheet();
  };

  return (
    <SheetBase>
      <SheetTitle
        title={restaurant ? `Order from ${restaurant.name}` : 'Order delivery'}
        sub={
          quotes.length > 0
            ? 'Fees below are estimates — final pricing shows at checkout.'
            : restaurant
              ? "No live quotes for this spot yet — search opens the provider's app."
              : 'Pick a provider — search opens the provider app to find your spot.'
        }
      />
      <View className="mb-2 mt-4 gap-y-2">
        {quotes.length > 0
          ? quotes.map((p) => (
              <LinkRow
                key={p.provider}
                onPress={() => openProvider(p.provider, p.url)}
                left={p.provider}
                badge={
                  p.best ? (
                    <View className="rounded-full bg-pine/10 px-2 py-0.5">
                      <Text className="font-dm-bold text-[10.5px] text-pine">Best</Text>
                    </View>
                  ) : undefined
                }
                right={
                  <Text className="font-dm text-label text-taupe">
                    {p.fee} · {p.eta}
                  </Text>
                }
              />
            ))
          : ['Uber Eats', 'DoorDash'].map((provider) => (
              <LinkRow
                key={provider}
                onPress={() => openProvider(provider)}
                left={provider}
                right={<Text className="font-dm text-label text-taupe">Search app</Text>}
              />
            ))}
      </View>
    </SheetBase>
  );
}

// ── Ride sheet ──────────────────────────────────────────────────────────────

function formatMinutes(total: number): string {
  const h24 = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const m = ((total % 60) + 60) % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function RideSheet() {
  const { rideContext, showToast, closeSheet, deviceLocation } = useScoper();
  const event = rideContext ? EVENTS[rideContext] : null;
  const pickup = deviceLocation
    ? { latitude: deviceLocation.latitude, longitude: deviceLocation.longitude, label: deviceLocation.label }
    : undefined;

  const openRide = (label: string, url: string) => {
    Linking.openURL(url)
      .then(() => {
        if (!event) showToast('Heading out? Plan a night in Create for where to go next');
      })
      .catch(() => showToast(`Could not open ${label}`));
    closeSheet();
  };

  if (!event) {
    return (
      <SheetBase>
        <SheetTitle title="Get a ride" sub="No specific plan yet — enter your destination once you're in the app." />
        <View className="mb-2 mt-4 gap-y-2">
          <LinkRow onPress={() => openRide('Uber', uberRideLink(GUEST.anchor, undefined, pickup))} left="Uber" right={<View />} />
          <LinkRow onPress={() => openRide('Lyft', lyftRideLink())} left="Lyft" right={<View />} />
        </View>
      </SheetBase>
    );
  }

  const address = streetAddress(event.addr);
  const leaveBy = formatMinutes(parseTimeToMinutes(event.time) - 40);

  return (
    <SheetBase>
      <SheetTitle title={`Ride to ${event.venue}`} sub={`${event.name} · ${event.time} — leave by about ${leaveBy}`} />
      <RaisedView className="mt-4 rounded-card px-3.5 py-1">
        <View className="flex-row justify-between border-b border-sand py-2.5">
          <Text className="font-dm text-[13px] text-taupe">From</Text>
          <Text className="font-dm-medium text-[13px] text-ink">{deviceLocation?.label || GUEST.anchor}</Text>
        </View>
        <View className="flex-row justify-between py-2.5">
          <Text className="font-dm text-[13px] text-taupe">To</Text>
          <Text className="font-dm-medium text-[13px] text-ink">{event.venue}</Text>
        </View>
      </RaisedView>
      <View className="mb-2 mt-4 gap-y-2">
        <LinkRow onPress={() => openRide('Uber', uberRideLink(address, event.venue, pickup))} left="Uber" right={<View />} />
        <LinkRow onPress={() => openRide('Lyft', lyftRideLink())} left="Lyft" right={<View />} />
      </View>
      <Text className="text-center font-dm text-meta text-taupe">{'Opens the Uber/Lyft app to book — Wayvee does not handle the ride itself.'}</Text>
    </SheetBase>
  );
}

// ── Auth sheet (sign in to save/plan/follow/taste) ──────────────────────────

function AuthSheet() {
  const closeSheet = useScoper((s) => s.closeSheet);
  useAndroidBack(closeSheet);
  return (
    <SheetBase scrollable>
      <AuthForm onAuthenticated={closeSheet} />
    </SheetBase>
  );
}

/** The actual sign-in/create-account form — everything AuthSheet renders
 * except the modal chrome, so a full-screen context (the arrival sequence)
 * can reuse the exact same fields, copy and validation instead of
 * duplicating them. `onAuthenticated` fires once a session lands, however
 * the caller wants to react (close a sheet, advance a screen). */
export function AuthForm({
  onAuthenticated,
  titleVariant = 'sheet',
}: {
  onAuthenticated?: () => void;
  /** 'page' matches the arrival sequence's larger step-title treatment (Fraunces-medium
   * 21px + a short one-line description) instead of the compact bottom-sheet title. */
  titleVariant?: 'sheet' | 'page';
}) {
  const { authError, clearAuthError, register, session, signIn, signInWithGoogle } = useScoper();
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (session) onAuthenticated?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const busy = busyAction !== null;
  const submitLabel = mode === 'sign-in' ? 'Sign in' : 'Create account';

  const switchMode = () => {
    setMode((current) => (current === 'sign-in' ? 'create' : 'sign-in'));
    setError(null);
    clearAuthError();
    setSuccess(null);
  };

  const submit = async () => {
    setError(null);
    clearAuthError();
    setSuccess(null);
    if (mode === 'create' && name.trim().length < 2) {
      setError('Add the name you would like Wayvee to use.');
      return;
    }
    if (mode === 'create' && name.trim().length > 80) {
      setError('Keep your name to 80 characters or fewer.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }

    setBusyAction('email');
    try {
      if (mode === 'sign-in') await signIn(email, password);
      else {
        const result = await register(name, email, password);
        if (result === 'check-email') {
          setSuccess(`Check ${email.trim().toLowerCase()} to confirm your account, then sign in.`);
          setMode('sign-in');
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const googleAccess = async () => {
    setError(null);
    clearAuthError();
    setSuccess(null);
    setBusyAction('google');
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in did not finish.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      {titleVariant === 'page' ? (
        <View className="mb-4">
          <WayveeWordmark size={26} />
          <Text className="mt-6 font-fraunces-medium text-[21px] text-rust">
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </Text>
          <Text className="mt-1 font-dm text-[13px] text-taupe">Syncs your saves and plans everywhere.</Text>
        </View>
      ) : (
        <SheetTitle
          title={mode === 'sign-in' ? 'Sign in to Wayvee' : 'Create your Wayvee'}
          sub="Keep your saves, plans, and taste profile synced to your account."
        />
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        activeOpacity={0.75}
        onPress={googleAccess}
        className={`mt-4 h-[48px] flex-row items-center justify-center gap-x-2.5 rounded-full border border-sand bg-cream ${busy ? 'opacity-60' : ''}`}>
        {busyAction === 'google' ? <ActivityIndicator color="#FFFFFF" /> : <GoogleLogo size={17} />}
        <Text className="font-dm-medium text-[13.5px] text-ink">Continue with Google</Text>
      </TouchableOpacity>

      <View className="my-3.5 flex-row items-center gap-x-3">
        <View className="h-px flex-1 bg-sand" />
        <Text className="font-dm text-meta text-taupe">or use email</Text>
        <View className="h-px flex-1 bg-sand" />
      </View>

      <View className="gap-y-3">
        {mode === 'create' ? (
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" autoComplete="name" maxLength={80} />
        ) : null}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoComplete="email" maxLength={254} />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="8+ characters"
          secureTextEntry
          autoComplete={mode === 'create' ? 'new-password' : 'password'}
          maxLength={128}
        />
      </View>

      {error || authError ? (
        <View className="mt-3 rounded-control border border-[rgba(69,201,194,0.35)] bg-coral-50 px-3.5 py-2.5">
          <Text accessibilityLiveRegion="polite" className="font-dm text-[12px] leading-[17px] text-peach">{error || authError}</Text>
        </View>
      ) : null}

      {success ? (
        <View className="mt-3 rounded-control border border-[rgba(97,199,154,0.35)] bg-sage px-3.5 py-2.5">
          <Text accessibilityLiveRegion="polite" className="font-dm text-[12px] leading-[17px] text-pine">{success}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        activeOpacity={0.82}
        onPress={submit}
        className={`mt-4 h-[48px] items-center justify-center rounded-full bg-ember ${busy ? 'opacity-60' : ''}`}>
        {busyAction === 'email' ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-dm-bold text-[14px] text-white">{submitLabel}</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        activeOpacity={0.7}
        onPress={switchMode}
        className="mt-2 items-center py-2">
        <Text className="font-dm text-label text-taupe">
          {mode === 'sign-in' ? 'New here? ' : 'Already have an account? '}
          <Text className="font-dm-bold text-peach">{mode === 'sign-in' ? 'Create account' : 'Sign in'}</Text>
        </Text>
      </TouchableOpacity>

      {!isAccountAuthConfigured ? (
        <Text className="mb-2 text-center font-dm text-[11.5px] leading-[16px] text-taupe">
          Supabase keys are missing for this build.
        </Text>
      ) : null}
    </>
  );
}

// ── Post-visit rating (screen 20) ───────────────────────────────────────────

const POST_VISIT_OPTIONS: { rating: VisitRating; emoji: string; label: string }[] = [
  { rating: 'not_for_me', emoji: '😐', label: 'Not for me' },
  { rating: 'fine', emoji: '🙂', label: 'Fine' },
  { rating: 'loved', emoji: '🤩', label: 'Loved it' },
];

function PostVisitSheet() {
  const target = useScoper((s) => s.postVisitTarget);
  const rateVisit = useScoper((s) => s.rateVisit);
  const skipVisitPrompt = useScoper((s) => s.skipVisitPrompt);

  if (!target) return null;

  return (
    <SheetBase>
      <SheetTitle title={`How was ${target.name}?`} sub={target.venue ? `${target.venue} · last night` : 'Last night'} />
      <View className="mt-4 flex-row gap-x-2.5">
        {POST_VISIT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.rating}
            accessibilityRole="button"
            activeOpacity={0.8}
            onPress={() => void rateVisit(option.rating)}
            className="flex-1 items-center gap-y-1.5 rounded-card border border-sand bg-cream py-3.5">
            <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
            <Text className="font-dm-medium text-label text-ink">{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => void skipVisitPrompt(true)} className="mb-1 mt-4 items-center">
        <Text className="font-dm text-label text-taupe">Skip · don&apos;t ask about shows again</Text>
      </TouchableOpacity>
    </SheetBase>
  );
}

// ── Logout confirm ──────────────────────────────────────────────────────────

function LogoutSheet() {
  const { closeSheet, signOut } = useScoper();
  const [signingOut, setSigningOut] = useState(false);

  const confirmLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SheetBase>
      <SheetTitle title="Log out of Wayvee?" />
      <Text className="mt-2 font-dm text-[13px] leading-[19px] text-taupe">
        Your saved places, plans, and taste profile all stay put — they&apos;ll be right here next time you sign in.
      </Text>
      <View className="mb-2 mt-4 gap-y-2">
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.8}
          disabled={signingOut}
          onPress={confirmLogout}
          className="items-center rounded-full bg-ember py-[15px]" style={{ opacity: signingOut ? 0.6 : 1 }}>
          <Text className="font-dm-medium text-[14.5px] text-white">{signingOut ? 'Logging out…' : 'Log out'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.8} disabled={signingOut} onPress={closeSheet} className="items-center rounded-full border border-sand py-[15px]">
          <Text className="font-dm-medium text-[14.5px] text-ink">Stay signed in</Text>
        </TouchableOpacity>
      </View>
    </SheetBase>
  );
}

// ── Stay sheet ───────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'Thu, Jul 26', device-local — for the check-in/checkout chips above the calendar. */
function formatStayDate(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** react-native-calendars period marking for the selected check-in→checkout range.
 * Reuses stayNightDates (checkIn through the night before checkout) for the interior
 * of the range, then marks checkout itself as the closing day. */
function buildStayMarkedDates(checkIn: string | null, checkOut: string | null, accent: string, onAccent: string): Record<string, object> {
  const marked: Record<string, object> = {};
  if (!checkIn) return marked;
  // Half-picked (or inverted, which the calendar's minDate should already
  // prevent) collapses to a single marked day rather than rendering a bar.
  if (!checkOut || checkOut <= checkIn) {
    marked[checkIn] = { startingDay: true, endingDay: true, color: accent, textColor: onAccent };
    return marked;
  }
  const nights = stayNightDates({ propertyName: '', checkIn, checkOut });
  nights.forEach((date, i) => {
    marked[date] = { startingDay: i === 0, endingDay: false, color: accent, textColor: onAccent };
  });
  marked[checkOut] = { startingDay: false, endingDay: true, color: accent, textColor: onAccent };
  return marked;
}

/** The chip pair above the calendar. Also the only way back to editing check-in
 * once a full range is picked, since checkout focus grays out earlier dates. */
function StayDateChip({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ? formatStayDate(value) : 'not set'}`}
      className={`flex-1 rounded-control border px-3 py-2 ${active ? 'border-rust bg-blush' : 'border-transparent bg-surface-sunk'}`}
    >
      <Text className="font-dm text-micro uppercase text-taupe">{label}</Text>
      <Text className={`mt-0.5 font-dm-medium text-body ${value ? 'text-ink' : 'text-taupe'}`}>
        {value ? formatStayDate(value) : 'Select'}
      </Text>
    </TouchableOpacity>
  );
}

function StaySheet() {
  const { closeSheet, clearStay, linkStay, stay } = useScoper();
  const c = useThemeColors();
  const [propertyName, setPropertyName] = useState(stay?.propertyName ?? '');
  const [checkIn, setCheckIn] = useState<string | null>(stay?.checkIn ?? null);
  const [checkOut, setCheckOut] = useState<string | null>(stay?.checkOut ?? null);
  const [error, setError] = useState<string | null>(null);
  // Tracks which action is in flight, not just whether one is — so the spinner
  // lands on the button the guest actually pressed instead of both at once.
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  // null = calendar collapsed. Otherwise which end of the range the next tap sets.
  const [focus, setFocus] = useState<'checkIn' | 'checkOut' | null>(null);

  // accent-fill/on-accent is the token pair meant to be read against each other —
  // plain accent (rust) under white text is only ~3.5:1 in the light theme.
  const onAccent = c['on-accent'];
  const markedDates = useMemo(
    () => buildStayMarkedDates(checkIn, checkOut, c.ember, onAccent),
    [checkIn, checkOut, c.ember, onAccent],
  );

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  // Opening the calendar from the property-name field would otherwise render it
  // behind the keyboard.
  const openCalendar = (end: 'checkIn' | 'checkOut') => {
    Keyboard.dismiss();
    setFocus(end);
  };

  const onDayPress = (day: DateData) => {
    setError(null);
    if (focus === 'checkOut' && checkIn) {
      setCheckOut(day.dateString);
      setFocus(null);
      return;
    }
    setCheckIn(day.dateString);
    // A new check-in invalidates a checkout that no longer sits after it.
    if (checkOut && checkOut <= day.dateString) setCheckOut(null);
    setFocus('checkOut');
  };

  const save = async () => {
    setError(null);
    const name = propertyName.trim();
    if (name.length < 2) {
      setError('Add where you’re staying.');
      return;
    }
    if (!checkIn || !checkOut) {
      setError('Pick both a check-in and checkout date.');
      return;
    }
    setBusy('save');
    try {
      await linkStay({ propertyName: name, checkIn, checkOut });
      closeSheet();
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      await clearStay();
      closeSheet();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SheetBase scrollable>
      <SheetTitle title={stay ? 'Update your stay' : 'Link your stay'} sub="Works for a hotel, an Airbnb, or wherever you're staying — never tied to a specific brand." />
      <View className="mt-4 gap-y-3">
        <Field label="Where you're staying" value={propertyName} onChangeText={setPropertyName} placeholder="Hotel or property name" autoCapitalize="words" maxLength={120} />
        <View className="flex-row gap-x-3">
          <StayDateChip label="Check-in" value={checkIn} active={focus === 'checkIn'} onPress={() => openCalendar('checkIn')} />
          <StayDateChip label="Checkout" value={checkOut} active={focus === 'checkOut'} onPress={() => openCalendar(checkIn ? 'checkOut' : 'checkIn')} />
        </View>
        {focus ? (
          <View className="overflow-hidden rounded-card border border-sand">
            <Calendar
              // Re-initializes the visible month when the focused end changes, so
              // re-editing either date lands on that date's month, not today's.
              initialDate={(focus === 'checkOut' ? checkOut ?? checkIn : checkIn) ?? todayIso()}
              minDate={focus === 'checkOut' && checkIn ? addDaysIso(checkIn, 1) : todayIso()}
              markingType="period"
              markedDates={markedDates}
              onDayPress={onDayPress}
              disableAllTouchEventsForDisabledDays
              enableSwipeMonths
              theme={{
                backgroundColor: c.shell,
                calendarBackground: c.shell,
                textSectionTitleColor: c.taupe,
                dayTextColor: c.ink,
                textDisabledColor: c.sand,
                monthTextColor: c.ink,
                todayTextColor: c.rust,
                arrowColor: c.rust,
                textDayFontFamily: 'DMSans_400Regular',
                textMonthFontFamily: 'DMSans_700Bold',
                textDayHeaderFontFamily: 'DMSans_500Medium',
              }}
            />
            <View className="flex-row items-center justify-between border-t border-sand px-3 py-2">
              <Text className="font-dm text-meta text-taupe">
                {focus === 'checkOut' && checkIn ? 'Now pick your checkout day' : 'Pick your check-in day'}
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setFocus(null)} accessibilityRole="button">
                <Text className="font-dm-medium text-meta text-rust">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {nights > 0 ? (
          <Text className="font-dm text-meta text-taupe">
            {nights} {nights === 1 ? 'night' : 'nights'} in Oakland
          </Text>
        ) : null}
      </View>
      {error ? <Text className="mt-3 font-dm text-label text-peach">{error}</Text> : null}
      <View className="mb-2 mt-4 gap-y-2">
        <TouchableOpacity
          disabled={busy !== null}
          activeOpacity={0.82}
          onPress={save}
          className={`flex-row items-center justify-center gap-x-2 rounded-full bg-rust py-[15px] ${busy ? 'opacity-60' : ''}`}>
          {busy === 'save' ? <ActivityIndicator size="small" color={c['on-accent']} /> : null}
          <Text className="font-dm-bold text-[14px] text-white">{stay ? 'Save changes' : 'Link my stay'}</Text>
        </TouchableOpacity>
        {stay ? (
          <TouchableOpacity
            disabled={busy !== null}
            activeOpacity={0.7}
            onPress={remove}
            className={`flex-row items-center justify-center gap-x-2 rounded-full border border-sand py-[15px] ${busy ? 'opacity-60' : ''}`}>
            {busy === 'remove' ? <ActivityIndicator size="small" color={c.taupe} /> : null}
            <Text className="font-dm-medium text-[13.5px] text-taupe">Remove stay</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SheetBase>
  );
}

// ── Filter sheet ────────────────────────────────────────────────────────────

// ── Search overlay (full screen, live results) ──────────────────────────────

const RESULTS_PER_KIND = 6;
const SUGGESTION_QUERY_LENGTH = 3;
// Display order — food/drink first (the app's core), then things to do, then broader entry points.
const KIND_ORDER: SearchResultKind[] = ['restaurant', 'dish', 'place', 'event', 'venue', 'night', 'crawl', 'pick', 'collection'];

function SearchOverlay() {
  const closeSheet = useScoper((s) => s.closeSheet);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [anim] = useState(() => new Animated.Value(0));
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [expandedKinds, setExpandedKinds] = useState<Set<SearchResultKind>>(new Set());
  const allPlaces = useAllPlaces();
  const allPicks = useViatorPicks();
  const tasteTags = useScoper((s) => s.tasteTags);

  useAndroidBack(closeSheet);
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [anim]);
  useEffect(() => {
    loadRecentSearches().then(setRecentSearches);
  }, []);

  const trimmedQuery = query.trim();
  const index = useMemo(() => buildSearchIndex(allPlaces, allPicks), [allPlaces, allPicks]);
  const vocabulary = useMemo(() => buildVocabulary(allPlaces), [allPlaces]);

  const results = useMemo(() => (trimmedQuery ? queryIndex(index, trimmedQuery, tasteTags) : []), [index, trimmedQuery, tasteTags]);
  const showSuggestions = trimmedQuery.length > 0 && trimmedQuery.length <= SUGGESTION_QUERY_LENGTH;
  const suggestions = useMemo(() => (showSuggestions ? suggestFor(trimmedQuery, vocabulary) : []), [showSuggestions, trimmedQuery, vocabulary]);

  const grouped = useMemo(() => {
    const byKind = new Map<SearchResultKind, SearchResult[]>();
    for (const result of results) {
      const bucket = byKind.get(result.kind) ?? [];
      bucket.push(result);
      byKind.set(result.kind, bucket);
    }
    return KIND_ORDER.map((kind) => ({ kind, items: byKind.get(kind) ?? [] })).filter((group) => group.items.length > 0);
  }, [results]);

  const featuredEvent = currentEventListings()[0];

  const goResult = (result: SearchResult) => {
    void recordRecentSearch({ label: result.title, href: result.href });
    if (trimmedQuery && (result.kind === 'restaurant' || result.kind === 'dish')) {
      const restaurantHref = canonicalRestaurantHref(result.href);
      const restaurantId = restaurantHref?.slice('/restaurant/'.length);
      const restaurantLabel = restaurantId ? RESTAURANTS[restaurantId]?.name : null;
      if (restaurantHref && restaurantLabel) {
        void recordRestaurantExploration({ href: restaurantHref, label: restaurantLabel });
      }
    }
    closeSheet();
    router.push(result.href);
  };
  const goEvent = (event: { id: string; name: string }) => {
    void recordRecentSearch({ label: event.name, href: `/event/${event.id}` });
    closeSheet();
    router.push(`/event/${event.id}`);
  };
  const goRecent = (entry: RecentSearch) => {
    closeSheet();
    router.push(entry.href);
  };
  const resetFilters = useScoper((state) => state.resetFilters);
  const toggleFlag = useScoper((state) => state.toggleFlag);
  const setSort = useScoper((state) => state.setSort);
  const goFoodAction = (link: HomeActionLink) => {
    resetFilters();
    if (link.flag) toggleFlag(link.flag);
    if (link.sort) setSort(link.sort);
    closeSheet();
    if (link.href) {
      router.push(link.href);
      return;
    }
    router.push(link.query ? `/featured?q=${encodeURIComponent(link.query)}` : '/featured');
  };
  const toggleExpanded = (kind: SearchResultKind) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const resultRow = (title: string, sub: string, onPress: () => void, key: string) => (
    <RaisedTouchable key={key} activeOpacity={0.7} onPress={onPress} className="flex-row items-center justify-between rounded-card px-3.5 py-3">
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} className="font-dm-medium text-[14px] text-ink">{title}</Text>
        <Text numberOfLines={1} className="mt-0.5 font-dm text-label text-taupe">{sub}</Text>
      </View>
      <ChevronRight />
    </RaisedTouchable>
  );

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        backgroundColor: colors.cream,
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        opacity: anim,
      }}>
      <View className="flex-row items-center gap-x-2.5">
        <View className="flex-1 flex-row items-center gap-x-2.5 rounded-full border border-sand bg-blush px-4 py-1">
          <SearchIcon size={15} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Places, dishes, shows…"
            placeholderTextColor={colors.taupe}
            returnKeyType="search"
            className="flex-1 py-2.5 font-dm text-[14px] text-ink"
          />
        </View>
        <TouchableOpacity onPress={closeSheet}>
          <Text className="font-dm-medium text-[14px] text-rust">Cancel</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="mt-[22px]" contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
        {trimmedQuery ? (
          <>
            {suggestions.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s.label}
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    onPress={() => setQuery(s.query)}
                    className="rounded-full border border-rust bg-blush px-3.5 py-1.5">
                    <Text className="font-dm-medium text-label text-peach">{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {grouped.map((group) => {
              const expanded = expandedKinds.has(group.kind);
              const visible = expanded ? group.items : group.items.slice(0, RESULTS_PER_KIND);
              const hiddenCount = group.items.length - visible.length;
              return (
                <View key={group.kind} className="gap-y-2.5">
                  <Text className="font-dm-medium text-label text-taupe">{SEARCH_KIND_LABELS[group.kind]}</Text>
                  {visible.map((r) => resultRow(r.title, r.subtitle, () => goResult(r), r.id))}
                  {hiddenCount > 0 ? (
                    <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => toggleExpanded(group.kind)} className="items-center py-1.5">
                      <Text className="font-dm-medium text-label text-peach">Show {hiddenCount} more</Text>
                    </TouchableOpacity>
                  ) : expanded && group.items.length > RESULTS_PER_KIND ? (
                    <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={() => toggleExpanded(group.kind)} className="items-center py-1.5">
                      <Text className="font-dm-medium text-label text-taupe">Show fewer</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
            {grouped.length === 0 && (
              <View className="gap-y-2.5">
                <RaisedView className="items-center rounded-card px-4 py-8">
                  <Text className="font-dm-medium text-[13.5px] text-ink">{`No matches for “${query}”`}</Text>
                  <Text className="mt-1 text-center font-dm text-label text-taupe">Try a restaurant, dish, cuisine, artist, or venue.</Text>
                </RaisedView>
                <AskVeeRow query={trimmedQuery} onNavigate={closeSheet} />
              </View>
            )}
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              {homeActionLinks().map((link) => (
                <TouchableOpacity
                  key={link.label}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  onPress={() => goFoodAction(link)}
                  className="rounded-full border border-rust bg-blush px-3.5 py-1.5">
                  <Text className="font-dm-medium text-label text-peach">{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {recentSearches.length > 0 ? (
              <View>
                <View className="mb-2.5 flex-row items-center justify-between">
                  <Text className="font-dm-medium text-label text-taupe">Recent searches</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    onPress={() => {
                      void clearRecentSearches();
                      setRecentSearches([]);
                    }}>
                    <Text className="font-dm-medium text-label text-rust">Clear</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {recentSearches.map((entry) => (
                    <TouchableOpacity
                      key={entry.href}
                      accessibilityRole="button"
                      activeOpacity={0.7}
                      onPress={() => goRecent(entry)}
                      className="rounded-full border border-sand bg-shell px-3.5 py-1.5">
                      <Text numberOfLines={1} className="font-dm-medium text-label text-ink">{entry.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            <View>
              <Text className="mb-2.5 font-dm-medium text-label text-taupe">Around {GUEST.anchor}</Text>
              <View className="gap-y-2.5">
                {resultRow('Late night eats', 'Sinaloa & Colonial Donuts — open past midnight', () => { closeSheet(); router.push('/collection/late-night'); }, 'collection')}
                {featuredEvent
                  ? resultRow(
                      featuredEvent.name,
                      `${featuredEvent.date.split(' · ')[0]} · ${featuredEvent.venue}`,
                      () => goEvent(featuredEvent),
                      featuredEvent.id,
                    )
                  : null}
                {resultRow('Upcoming official listings', 'Dated listings update automatically', () => { closeSheet(); router.push('/discover'); }, 'discover')}
              </View>
            </View>
            <AskVeeRow onNavigate={closeSheet} />
            <Text className="text-center font-dm text-label text-taupe">Search restaurants, dishes, cuisines, artists, or venues</Text>
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ── Ask concierge sheet ──────────────────────────────────────────────────────

/** One new entry point on Home (docs/build-book.md Part 3.8/4.1) — reuses the
 * existing search-bar visual and this file's own bottom-sheet pattern. On
 * submit, calls the concierge Edge Function to parse intent, then runs the
 * exact same plan-engine pipeline create.tsx already uses. Any failure —
 * no key, rate limit, network down, a request that fails validation — falls
 * back to ordinary browsing rather than showing an error (CLAUDE.md #6). */
function AskSheet() {
  const router = useRouter();
  const { closeSheet, showToast, deviceLocation, tasteTags, pacePreference, setAskPlan, askPlan, askRequest } = useScoper();
  const curatedCoords = useCuratedCoords();
  const curatedHours = useCuratedHours();
  const weatherNow = useWeatherNow();
  const moodVocabulary = useMemo(() => tasteVocabulary(), []);
  const [text, setText] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleMood = (tag: string) => setSelectedMoods((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

  const submit = async () => {
    const rawText = [text.trim(), ...selectedMoods].filter(Boolean).join(' — ');
    if (!rawText || busy) return;
    setBusy(true);

    // The model call is the only network step here — loadDinnerHistory and
    // readSyncStatus are local/Supabase reads that don't depend on its result,
    // so they run alongside it instead of waiting their turn behind it.
    const [request, recentRestaurantIds, syncRows] = await Promise.all([
      requestConciergeRequest(rawText, moodVocabulary),
      loadDinnerHistory(),
      readSyncStatus(),
    ]);

    // A null request (parse failed) and a structurally-valid-but-empty one
    // (model's own honest "low confidence, nothing to go on") both mean there
    // was no real signal to plan from — routed the same way, since a plan
    // built from nothing would look just as confident on screen as a real
    // match (CLAUDE.md #5).
    if (conciergeDeclined(request)) {
      setBusy(false);
      closeSheet();
      showToast("Couldn't build a plan from that — here's tonight");
      router.push('/discover');
      return;
    }

    // 'refine' merges onto the plan already on screen (concierge/adapter.ts's
    // mergeRefineRequest) so a short "make that cheaper" doesn't silently
    // drop the pace/mood/exclusions already established. With no previous
    // plan to merge onto, it's left as 'refine' and falls through the next
    // check to the same honest decline /answer already renders for it.
    const isRefine = request!.intent === 'refine' && Boolean(askRequest && askPlan);
    const effectiveRequest = isRefine ? mergeRefineRequest(askRequest!, request!) : request!;

    // Not every question is an evening — anything that isn't gets the shape
    // it asked for (same routing create.tsx's own composer applies).
    if (effectiveRequest.intent !== 'plan_evening') {
      setBusy(false);
      setText('');
      closeSheet();
      router.push(routeForRequest(effectiveRequest));
      return;
    }

    const rawPlan = buildPlan(effectiveRequest, {
      anchor: deviceLocation,
      tasteTags,
      coordsOf: curatedCoords,
      hoursOf: curatedHours,
      weather: weatherNow,
      now: resolveAskNow(new Date()),
      recentRestaurantIds,
      avoidRestaurantId: isRefine ? (askPlan!.solved.restaurant?.id ?? null) : null,
      avoidEventId: isRefine ? (askPlan!.solved.event?.id ?? null) : null,
    });
    const plan = applyFreshness(rawPlan, effectiveRequest.pace ?? pacePreference ?? 'Relaxed', syncRows);

    setBusy(false);
    setAskPlan(plan, effectiveRequest);
    closeSheet();
    router.push('/plan');
  };

  return (
    <SheetBase scrollable>
      <SheetTitle title="What sounds good tonight?" sub="Dinner and something after, nothing too far, back by whenever." />
      <View className="mt-4 gap-y-3">
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Dinner and something with live music, walking distance, back by 10:30"
          placeholderTextColor="#9C9086"
          className="min-h-[64px] rounded-card border border-sand bg-shell px-3.5 py-3 font-dm text-[14px] text-ink"
        />
        {moodVocabulary.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {moodVocabulary.slice(0, 12).map((tag) => (
              <OptionPill key={tag} label={tag} small active={selectedMoods.includes(tag)} onPress={() => toggleMood(tag)} />
            ))}
          </View>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          disabled={busy || !text.trim()}
          onPress={submit}
          className={`items-center rounded-full py-[15px] ${busy || !text.trim() ? 'bg-sand' : 'bg-rust'}`}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-dm-bold text-[14.5px] text-white">Plan it</Text>}
        </TouchableOpacity>
      </View>
    </SheetBase>
  );
}

function StartTimePickerSheet() {
  const { startTimePreference, setStartTimePreference, closeSheet } = useScoper();
  return (
    <SheetBase scrollable>
      <SheetTitle title="Start time" sub="When should the night kick off?" />
      <View className="mt-4 flex-row flex-wrap gap-2">
        {START_TIME_OPTIONS.map((option) => (
          <OptionPill
            key={option}
            small
            label={option}
            active={option === startTimePreference}
            onPress={() => {
              setStartTimePreference(option === startTimePreference ? null : option);
              closeSheet();
            }}
          />
        ))}
      </View>
    </SheetBase>
  );
}

/** "+ Add" on the constraint row — currently the one real, honest addable
 * constraint: whether to include a nightcap stop, decoupled from pace (pace
 * alone used to be the only way a nightcap got added, at 'Packed'). Kept to
 * a single option rather than padding the list with placeholder toggles. */
function AddConstraintSheet() {
  const { wantsNightlife, setWantsNightlife, closeSheet } = useScoper();
  return (
    <SheetBase>
      <SheetTitle title="Add a constraint" />
      <View className="mt-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ selected: wantsNightlife === true }}
          activeOpacity={0.72}
          onPress={() => {
            setWantsNightlife(true);
            closeSheet();
          }}
          className={`flex-row items-center justify-between rounded-card border px-4 py-3.5 ${
            wantsNightlife === true ? 'border-rust bg-coral-50' : 'border-sand bg-shell'
          }`}>
          <View className="min-w-0 flex-1">
            <Text className="font-dm-medium text-[13.5px] text-ink">Nightcap</Text>
            <Text className="mt-0.5 font-dm text-meta text-taupe">Add a late-night stop after dinner</Text>
          </View>
          <ChevronRight />
        </TouchableOpacity>
      </View>
    </SheetBase>
  );
}

// ── Host ────────────────────────────────────────────────────────────────────

export function GlobalOverlays() {
  const sheet = useScoper((s) => s.sheet);
  return (
    <>
      {sheet === 'search' && <SearchOverlay />}
      {sheet === 'delivery' && <DeliverySheet />}
      {sheet === 'ride' && <RideSheet />}
      {sheet === 'logout' && <LogoutSheet />}
      {sheet === 'stay' && <StaySheet />}
      {sheet === 'auth' && <AuthSheet />}
      {sheet === 'ask' && <AskSheet />}
      {sheet === 'startTime' && <StartTimePickerSheet />}
      {sheet === 'addConstraint' && <AddConstraintSheet />}
      {sheet === 'postVisit' && <PostVisitSheet />}
      <OfflineBanner />
      <Toast />
    </>
  );
}
