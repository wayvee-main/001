import '../global.css';

import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Fraunces_500Medium, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform } from 'react-native';

import { ArrivalSequence } from '@/components/arrival-sequence';
import { BrandIntro } from '@/components/brand-intro';
import { AppErrorBoundary } from '@/components/error-boundary';
import { AppBackdrop } from '@/components/layout';
import { LaunchScreen } from '@/components/onboarding';
import { GlobalOverlays } from '@/components/overlays';
import { applyAppearance, restoreAppearance } from '@/lib/appearance';
import { startContentHydration, useContentHydrating } from '@/lib/bootstrap';
import { checkWeatherRecovery, markRecoveryNotified, shouldNotifyRecovery } from '@/lib/concierge/recovery';
import { scheduleReminder } from '@/lib/notifications';
import { useScoper } from '@/lib/store';
import { useWeatherHours } from '@/lib/weather';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
// setOptions is unsupported in Expo Go (dev-build/standalone only) — calling it there logs a warning.
if (Constants.appOwnership !== 'expo') SplashScreen.setOptions({ duration: 350, fade: true });

let bootstrapStarted = false;

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}

function AppShell() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  // Plays once per cold start, after bootstrap resolves so it knows where it is
  // handing off to, and again between the last onboarding step and Home.
  const [intro, setIntro] = useState<'splash' | 'handoff' | null>('splash');
  const { arrivalStatus, bootstrapReady, checkPostVisitPrompt, completeArrival, hydrateApp, userDataReady, plans, showToast } = useScoper();
  const { colorScheme } = useColorScheme();
  const statusBarStyle = colorScheme === 'light' ? 'dark' : 'light';
  // Subscribing here re-renders every mounted screen once events/places/Viator
  // picks land — events-remote.ts/places.ts store hydrated rows in a plain
  // mutable record that screens read directly, not through a reactive hook,
  // so something up the tree has to force the re-read. Viator picks additionally
  // have their own reactive subscription (useViatorPicks in lib/viator.ts).
  useContentHydrating();
  const weatherHours = useWeatherHours();

  // Weather-triggered recovery (TODO.md Phase 3): re-checks every planned
  // outdoor event against the latest forecast whenever either changes. Each
  // event only ever surfaces once per day (shouldNotifyRecovery) — a guest
  // should hear "this might rain out" once, not on every hourly weather sync.
  useEffect(() => {
    if (!bootstrapReady || !userDataReady || plans.length === 0 || weatherHours.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const alert of checkWeatherRecovery(plans, weatherHours)) {
        if (cancelled) return;
        if (!(await shouldNotifyRecovery(alert.eventId))) continue;
        const body = alert.alternative
          ? `${alert.precipProbability}% rain expected — ${alert.alternative.name} is a real indoor option tonight.`
          : `${alert.precipProbability}% rain expected for ${alert.eventName} tonight.`;
        showToast(`Rain check: ${alert.eventName}`);
        // Fires almost immediately — reuses the same scheduled-notification
        // path plan reminders use (notifications.ts) rather than a second,
        // parallel "notify right now" API, and inherits its native/web
        // fallback behavior (web silently no-ops, never fakes success).
        void scheduleReminder(`weather-recovery-${alert.eventId}`, "Weather may affect tonight's plan", body, new Date(Date.now() + 2000));
        await markRecoveryNotified(alert.eventId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapReady, userDataReady, plans, weatherHours, showToast]);

  // Post-visit rating (screen 20): checked once bootstrap settles and again
  // whenever the plan list changes (a plan un-planned or freshly attended
  // shifts what's eligible). checkPostVisitPrompt is itself a no-op if
  // another sheet is already up or the guest opted out.
  useEffect(() => {
    if (!bootstrapReady || !userDataReady) return;
    void checkPostVisitPrompt();
  }, [bootstrapReady, userDataReady, plans, checkPostVisitPrompt]);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    // Ahead of hydration: the splash is still up, so pinning the scheme here
    // avoids a light-themed frame flashing past a guest who chose dark.
    restoreAppearance().then(applyAppearance).catch(() => undefined);
    hydrateApp().catch(() => undefined);
    void startContentHydration();
  }, [hydrateApp]);

  useEffect(() => {
    if (fontsLoaded && bootstrapReady && userDataReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [bootstrapReady, fontsLoaded, userDataReady]);

  if (!fontsLoaded) {
    if (Platform.OS !== 'web') return null;
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <LaunchScreen />
      </>
    );
  }

  if (!bootstrapReady || !userDataReady) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <LaunchScreen />
      </>
    );
  }

  // The opening motion sits on top of whichever destination is already mounted
  // underneath, so the frame it uncovers is the real screen rather than a still
  // of it. 'splash' recedes toward the header the welcome step draws; 'handoff'
  // settles in place.
  const opening = intro ? (
    <BrandIntro
      mode={arrivalStatus === 'unknown' ? 'splash' : 'handoff'}
      onComplete={() => setIntro(null)}
    />
  ) : null;

  // Persisted, not component state: a returning guest has already answered
  // these questions, and re-asking every cold launch is the fastest way to make
  // the app feel like it isn't listening.
  if (arrivalStatus === 'unknown') {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <ArrivalSequence
          onDone={() => {
            setIntro('handoff');
            void completeArrival();
          }}
        />
        <GlobalOverlays />
        {opening}
      </>
    );
  }

  return (
    // Solid, unanimated backdrop — stays opaque across the Positioner→Home cut
    // instead of fading with the content, so there's never a transparent frame
    // between the two (root has no background of its own beneath this).
    <AppBackdrop>
      <FadeIn>
        <StatusBar style={statusBarStyle} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}>
          <Stack.Screen name="plan" options={{ animation: 'fade_from_bottom', gestureEnabled: true }} />
          <Stack.Screen name="answer" options={{ animation: 'fade_from_bottom', gestureEnabled: true }} />
        </Stack>
        <GlobalOverlays />
      </FadeIn>
      {opening}
    </AppBackdrop>
  );
}

/** The Positioner's other half — Home's own soft entrance once the sequence
 * hands off, replacing what used to be an instant, unanimated mount. */
function FadeIn({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(10));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
