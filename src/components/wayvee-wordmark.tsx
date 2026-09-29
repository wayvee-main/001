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
  /** Vee's own state. The brand lockup is solid; the launch screen is not. */
  gradient = false,
}: {
  size?: number;
  /** Colour of the word. The mark keeps the accent unless this is given. */
  color?: string;
  gradient?: boolean;
}) {
  const colors = useThemeColors();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Wayvee"
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.35 }}>
      <VeeMark size={size * 0.95} variant={size >= 28 ? 'primary' : 'compact'} gradient={gradient} color={color} />
      <Text
        className="font-fraunces"
        style={{ fontSize: size, lineHeight: size * 1.12, letterSpacing: size * -0.018, color: color ?? colors.fg }}>
        Wayvee
      </Text>
    </View>
  );
}
