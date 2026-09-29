import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { AppBackdrop } from '@/components/layout';
import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

/**
 * Wayvee's opening motion: the mark resolves, the word rises beneath it, and
 * the pair hands off to whatever is already mounted underneath.
 *
 * The mark carries the gradient here and only here at rest — the opening is
 * Vee starting up, the same reading the launch screen's breathing mark has, so
 * the two frames are one continuous thought rather than a cut.
 *
 * `mode` decides the exit, not the entrance. `splash` recedes upward toward the
 * header lockup the next screen draws; `handoff` settles in place, because it
 * plays over the move into Home where nothing needs to be aimed at. An earlier
 * version flew the wordmark into the header's exact coordinates; that depended
 * on the wordmark being a bitmap of known aspect, and it is now live type whose
 * width comes from font metrics, so the landing point is no longer arithmetic.
 *
 * Reduce-motion gets a short crossfade instead of the full sequence: the same
 * beat, none of the travel.
 */
export function BrandIntro({ mode, onComplete }: { mode: 'splash' | 'handoff'; onComplete: () => void }) {
  const colors = useThemeColors();

  // useState rather than useRef for every animated value: they are read during
  // render by the style props below, which a ref must never be.
  const [overlayOpacity] = useState(() => new Animated.Value(1));
  const [markOpacity] = useState(() => new Animated.Value(0));
  const [markScale] = useState(() => new Animated.Value(0.64));
  const [wordOpacity] = useState(() => new Animated.Value(0));
  const [wordRise] = useState(() => new Animated.Value(14));
  const [exitLift] = useState(() => new Animated.Value(0));
  const [exitScale] = useState(() => new Animated.Value(1));
  const completed = useRef(false);

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;

    const finish = () => {
      if (!mounted || completed.current) return;
      completed.current = true;
      onComplete();
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted) return;

      if (reduceMotion) {
        markOpacity.setValue(1);
        markScale.setValue(1);
        wordOpacity.setValue(1);
        wordRise.setValue(0);
        animation = Animated.sequence([
          Animated.delay(280),
          Animated.timing(overlayOpacity, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]);
        animation.start(finish);
        return;
      }

      animation = Animated.sequence([
        Animated.delay(90),
        Animated.parallel([
          Animated.timing(markOpacity, { toValue: 1, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(markScale, { toValue: 1, damping: 9, mass: 0.7, stiffness: 150, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(95),
          Animated.parallel([
            Animated.timing(wordOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(wordRise, { toValue: 0, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(exitLift, { toValue: mode === 'splash' ? -22 : 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(exitScale, { toValue: mode === 'splash' ? 0.88 : 0.94, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(110),
            Animated.timing(overlayOpacity, { toValue: 0, duration: 410, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
      ]);
      animation.start(finish);
    });

    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [exitLift, exitScale, markOpacity, markScale, mode, onComplete, overlayOpacity, wordOpacity, wordRise]);

  return (
    <Animated.View
      accessibilityElementsHidden
      accessibilityLabel="Wayvee"
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: 20, opacity: overlayOpacity }]}>
      <AppBackdrop>
        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <Animated.View
            className="items-center gap-y-5"
            style={{ transform: [{ translateY: exitLift }, { scale: exitScale }] }}>
            <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}>
              <VeeMark size={78} gradient />
            </Animated.View>
            <Animated.View style={{ opacity: wordOpacity, transform: [{ translateY: wordRise }] }}>
              <Text style={{ color: colors.fg }} className="font-fraunces text-[32px]">
                Wayvee
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </AppBackdrop>
    </Animated.View>
  );
}
