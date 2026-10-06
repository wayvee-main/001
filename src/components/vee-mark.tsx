import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useThemeColors } from '@/lib/theme';

/**
 * Wayvee's mark: a wave seen end on, drawn as the spiral a breaking wave makes.
 *
 * It replaces a fork — a way that split, with one branch lit — which said the
 * name (way plus vee) but said nothing about going anywhere. The spiral says
 * both: it is water, and it is a thing in motion that has not finished moving.
 *
 * The geometry is not freehand. Each arc is a half turn whose radius doubles —
 * 0.9, 1.8, 3.6, 7.2, 14.4 — so every turn sits on the one before it and the
 * curve tightens the way a vortex actually does. That is also why it survives
 * being shrunk: the relationship between turns is fixed, so the whole thing
 * scales as one object rather than drifting out of proportion.
 *
 * One shape, two states, and the state is the whole convention:
 *   solid accent   — the app being itself. Icon, header, tab bar, plan stops.
 *   gradient       — Vee. Static where Vee is speaking, turning where Vee is
 *                    working. Fixed hexes rather than theme tokens, because the
 *                    gradient is a mark and must read the same on paper and on
 *                    plum-black, the way an app icon does.
 *
 * scripts/generate-icons.mjs restates this geometry, because the PNGs are
 * rasterised by a browser rather than by React Native. Change the path here and
 * run `npm run icons`, or the app and its launcher icon drift apart.
 */

export type VeeVariant =
  /** Every turn. The mark wherever it has room — 28px and up. */
  | 'primary'
  /** The three outer turns only, at a heavier weight. For 28px and under. */
  | 'compact';

/** Marigold → coral → cobalt → marigold, the run the retired orb carried. */
const GRADIENT_STOPS: readonly [string, string, string, string] = ['#FFC757', '#E85D2C', '#6F5BD1', '#FFC757'];
const GRADIENT_OFFSETS: readonly [string, string, string, string] = ['0', '0.35', '0.72', '1'];

/**
 * The spiral, centred.
 *
 * Drawn from the inside out, its bounding box lands at x 5.6–34.4 and
 * y 9.2–30.8 — centred on (20, 20) in the viewBox, so the mark sits level with
 * type set beside it instead of riding low and to the left.
 */
const SPIRAL =
  'M25.4 16.4 A0.9 0.9 0 0 1 23.6 16.4 A1.8 1.8 0 0 1 27.2 16.4 A3.6 3.6 0 0 1 20 16.4 A7.2 7.2 0 0 1 34.4 16.4 A14.4 14.4 0 0 1 5.6 16.4';

/**
 * The same spiral with its two innermost turns dropped.
 *
 * Those turns have radii of 0.9 and 1.8 on a 40-unit grid: under about 28px
 * they are thinner than the stroke drawing them, so they fill in and the centre
 * becomes a blot. Starting at the third turn keeps an open middle, and the
 * bounding box is identical — the turns that set it are still here — so compact
 * and primary occupy exactly the same space and can be swapped mid-layout.
 */
const SPIRAL_COMPACT = 'M27.2 16.4 A3.6 3.6 0 0 1 20 16.4 A7.2 7.2 0 0 1 34.4 16.4 A14.4 14.4 0 0 1 5.6 16.4';

const DEFAULT_STROKE: Record<VeeVariant, number> = {
  primary: 2.1,
  compact: 3,
};

let gradientSeq = 0;

export function VeeMark({
  size = 24,
  variant = 'primary',
  color,
  gradient = false,
  strokeWidth,
}: {
  size?: number;
  variant?: VeeVariant;
  /** Ignored when `gradient` is set. Defaults to the theme's accent. */
  color?: string;
  /** Vee's own state — see the header note. */
  gradient?: boolean;
  strokeWidth?: number;
}) {
  const colors = useThemeColors();
  // One id per mounted mark: two gradients sharing an id in the same tree
  // resolve to whichever rendered first, which silently blanks the second.
  const [gradientId] = useState(() => `veeGradient${(gradientSeq += 1)}`);
  const paint = gradient ? `url(#${gradientId})` : (color ?? colors.accent);
  const sw = strokeWidth ?? DEFAULT_STROKE[variant];

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {gradient ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            {GRADIENT_STOPS.map((stop, index) => (
              <Stop key={stop + String(index)} offset={GRADIENT_OFFSETS[index]} stopColor={stop} />
            ))}
          </LinearGradient>
        </Defs>
      ) : null}
      <Path
        d={variant === 'compact' ? SPIRAL_COMPACT : SPIRAL}
        stroke={paint}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * The mark while Vee is working: the spiral in gradient, turning.
 *
 * It used to breathe — scale and opacity — because a fork has no direction to
 * move in. A spiral does, and turning is the only motion it can make that is
 * about the shape rather than applied to it. One revolution every seven
 * seconds: present enough to read as working, slow enough not to nag.
 *
 * Honours the OS reduce-motion setting by simply holding still, the same
 * contract the orb it replaces had.
 */
export function WorkingVee({ size = 66 }: { size?: number }) {
  // useState rather than useRef: an Animated.Value read during render is a ref
  // access, and this one is read straight into the style below.
  const [turn] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      loop = Animated.loop(
        Animated.timing(turn, {
          toValue: 1,
          duration: 7000,
          // Linear: an eased revolution reads as hesitating, and this one never
          // arrives anywhere, so there is nothing for an ease to express.
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
    });

    return () => {
      mounted = false;
      loop?.stop();
    };
  }, [turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View accessibilityRole="image" accessibilityLabel="Vee is working" style={{ width: size, height: size }}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <VeeMark size={size} variant="primary" gradient />
      </Animated.View>
    </View>
  );
}
