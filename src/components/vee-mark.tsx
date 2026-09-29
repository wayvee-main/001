import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useThemeColors } from '@/lib/theme';

/**
 * Wayvee's mark: a way that forks, with one branch lit. The name states the
 * geometry — way plus vee — so the product and its drawing say the same thing.
 *
 * One shape, two states, and the state is the whole convention:
 *   solid accent   — the app being itself. Icon, header, tab bar, plan stops.
 *   gradient       — Vee. Static where Vee is speaking, breathing where Vee is
 *                    working. Fixed hexes rather than theme tokens, because the
 *                    gradient is a mark and must read the same on paper and on
 *                    plum-black, the way an app icon does.
 *
 * The variants are the same drawing re-terminated, never new shapes, so they
 * read as one family. `compact` exists because the curves and the open ring
 * stop resolving below about 28px — every variant above that keeps the full
 * fork, and nothing that pulses is ever drawn small enough to need the swap.
 */

export type VeeVariant =
  /** The full fork: open ring on the way not taken, filled dot on the way taken. */
  | 'primary'
  /** Straight branches, one terminal. For 28px and under — tab bar, favicon. */
  | 'compact'
  /** One way, no fork. A stop on the plan, a travel leg. */
  | 'single'
  /** Both ends filled: more than one answer qualifies. */
  | 'both'
  /** Dashed and open, matching the dashed-border idiom for an empty container. */
  | 'unset'
  /** Ring and dot: current stop, map pin, list bullet. */
  | 'here';

/** Marigold → coral → cobalt → marigold, the run the retired orb carried. */
const GRADIENT_STOPS: readonly [string, string, string, string] = ['#FFC757', '#E85D2C', '#6F5BD1', '#FFC757'];
const GRADIENT_OFFSETS: readonly [string, string, string, string] = ['0', '0.35', '0.72', '1'];

/**
 * Where a branch stops and what sits at its end.
 *
 * A filled terminal swallows the branch tip, so the branch can run right into
 * its centre. An open one cannot: a tip inside the ring fills the hole, and the
 * mark reads as two dots — way taken, way taken — instead of one of each. So an
 * open terminal sits further out and its branch stops clear of the hole. The
 * two are mirrored about x=20 rather than drawn twice, which is what keeps the
 * fork symmetric when a variant changes only one side.
 */
const FILLED_END = { branch: 10.5, control: 14.5, cx: 9, r: 3.5 };
const OPEN_END = { branch: 12.4, control: 15.9, cx: 8.4, r: 3.2 };
const mirror = (x: number) => 40 - x;

const DEFAULT_STROKE: Record<VeeVariant, number> = {
  primary: 2.3,
  compact: 2.9,
  single: 2.4,
  both: 2.3,
  unset: 2.1,
  here: 2.4,
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
  const dash = variant === 'unset' ? '3 3' : undefined;
  const left = variant === 'both' ? FILLED_END : OPEN_END;
  const right = variant === 'unset' ? OPEN_END : FILLED_END;

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
      {variant === 'here' ? (
        <>
          <Circle cx="20" cy="20" r="11" stroke={paint} strokeWidth={sw} fill="none" />
          <Circle cx="20" cy="20" r="5" fill={paint} />
        </>
      ) : variant === 'compact' ? (
        <>
          <Path d="M20 35 V 26" stroke={paint} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M20 26 L 10.5 16.5" stroke={paint} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M20 26 L 29 17" stroke={paint} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="30.5" cy="15.5" r="3.7" fill={paint} />
        </>
      ) : variant === 'single' ? (
        <>
          <Path d="M14 34 V 26" stroke={paint} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M14 26 C 14 17, 21 15, 26 15" stroke={paint} strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Circle cx="28.5" cy="15" r="3.4" fill={paint} />
        </>
      ) : (
        <>
          <Path d="M20 34 V 23" stroke={paint} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
          <Path
            d={`M20 23 C 20 16, ${left.control} 14.5, ${left.branch} 14.5`}
            stroke={paint}
            strokeWidth={sw}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={dash}
          />
          <Path
            d={`M20 23 C 20 16, ${mirror(right.control)} 14.5, ${mirror(right.branch)} 14.5`}
            stroke={paint}
            strokeWidth={sw}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={dash}
          />
          {variant === 'both' ? (
            <Circle cx={left.cx} cy="14.5" r={left.r} fill={paint} />
          ) : (
            <Circle cx={left.cx} cy="14.5" r={left.r} stroke={paint} strokeWidth={sw} fill="none" />
          )}
          {variant === 'unset' ? (
            <Circle cx={mirror(right.cx)} cy="14.5" r={right.r} stroke={paint} strokeWidth={sw} fill="none" />
          ) : (
            <Circle cx={mirror(right.cx)} cy="14.5" r={right.r} fill={paint} />
          )}
        </>
      )}
    </Svg>
  );
}

/**
 * The mark while Vee is working: the full fork in gradient, breathing.
 *
 * Used for the launch screen and anywhere the app is waiting on something it
 * cannot yet show. Never the compact variant — a pulsing mark is always large
 * enough for the fork, since loading is never a tab icon. Honours the OS
 * reduce-motion setting by simply holding still, the same contract the orb it
 * replaces had.
 */
export function WorkingVee({ size = 66 }: { size?: number }) {
  // useState rather than useRef: an Animated.Value read during render is a ref
  // access, and this one is read straight into the style below.
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.085, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.86, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ]),
      );
      loop.start();
    });

    return () => {
      mounted = false;
      loop?.stop();
    };
  }, [scale, opacity]);

  return (
    <View accessibilityRole="image" accessibilityLabel="Vee is working" style={{ width: size, height: size }}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <VeeMark size={size} variant="primary" gradient />
      </Animated.View>
    </View>
  );
}
