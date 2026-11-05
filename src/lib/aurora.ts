import { useColorScheme } from 'nativewind';

import { AURORA, AURORA_FIXED, hexToRgb } from '@/lib/tokens';

export type AuroraTheme = (typeof AURORA)['light'] & typeof AURORA_FIXED & { scheme: 'light' | 'dark' };

/** Theme-resolved Aurora values: gradients, glow, frosted surfaces and rules.
 * Solid colors still come from useThemeColors(); this covers what a hex role can't. */
export function useAurora(): AuroraTheme {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  return { ...AURORA[scheme], ...AURORA_FIXED, scheme };
}

/** Per-character colors along a gradient. Headline phrases are colored glyph by
 * glyph with nested Text, so they wrap, scale and read like ordinary text on
 * every platform without a masked view or a measured SVG. */
export function gradientColors(stops: readonly string[], count: number): string[] {
  if (count <= 0) return [];
  if (count === 1 || stops.length === 1) return Array(count).fill(stops[0]);
  const channels = stops.map(hexToRgb);
  return Array.from({ length: count }, (_, index) => {
    const position = (index / (count - 1)) * (channels.length - 1);
    const segment = Math.min(channels.length - 2, Math.floor(position));
    const t = position - segment, a = channels[segment], b = channels[segment + 1];
    return `#${a.map((value, k) => Math.round(value * (1 - t) + b[k] * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  });
}

/** A smooth pulse for a looping 0→1 driver: full strength at `phase`, dimmest half
 * a cycle later. Returned as interpolate() ranges so one native-driven loop can
 * stagger any number of glyphs. */
export function pulseRanges(phase: number, low: number, high = 1, samples = 12): { inputRange: number[]; outputRange: number[] } {
  const inputRange = Array.from({ length: samples + 1 }, (_, index) => index / samples);
  const mid = (high + low) / 2, amplitude = (high - low) / 2;
  return { inputRange, outputRange: inputRange.map(t => Number((mid + amplitude * Math.cos(2 * Math.PI * (t - phase))).toFixed(4))) };
}
