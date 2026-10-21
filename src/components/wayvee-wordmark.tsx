import { Text, View } from 'react-native';

import { VeeMark } from '@/components/vee-mark';
import { useThemeColors } from '@/lib/theme';

/**
 * The Wayvee lockup: the mark, then the word set in the app's own display face.
 *
 * Set as live text rather than the bitmap its predecessor used. The old
 * wordmark rode along as a base64 PNG because it was lettering the app could
 * not reproduce; this one is Fraunces at a weight already loaded for every
 * heading, so a bitmap would only be a blurrier copy of type the app has.
 * That also drops ~25KB of base64 from the bundle and lets the mark and the
 * word take different colours, which the single tinted bitmap could not.
 *
 * `size` is the cap height of the word and the height of the mark beside it —
 * the two are drawn to match, so callers size the lockup by its type rather
 * than guessing at an artwork width.
 */
export function WayveeWordmark({
  size = 20,
  color,
  /** Backward-compatible prop; every spiral uses the brand gradient. */
  gradient = true,
  mark = true,
}: {
  size?: number;
  /** Colour of the lettering; the spiral keeps its gradient. */
  color?: string;
  gradient?: boolean;
  /** Set false where the word alone should carry the brand. Home's header is
   * the one such place: the spiral is already on screen twice below it, in the
   * concierge panel and in the navigation. */
  mark?: boolean;
}) {
  const colors = useThemeColors();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Wayvee"
      style={{ flexDirection: 'row', alignItems: 'center', gap: mark ? size * 0.35 : 0 }}>
      {mark ? <VeeMark size={size * 0.95} variant={size >= 28 ? 'primary' : 'compact'} gradient={gradient} color={color} /> : null}
      <Text
        className="font-fraunces"
        style={{ fontSize: size, lineHeight: size * 1.12, letterSpacing: size * -0.018, color: color ?? colors.fg }}>
        Wayvee
      </Text>
    </View>
  );
}
