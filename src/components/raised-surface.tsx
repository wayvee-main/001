import { TouchableOpacity, View, type TouchableOpacityProps, type ViewProps } from 'react-native';

import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

export type RaisedSurfaceTone = 'neutral' | 'accent' | 'vee' | 'warm';

function useToneFill(tone: RaisedSurfaceTone) {
  const colors = useThemeColors();
  if (tone === 'accent') return colors['accent-tint'];
  if (tone === 'vee') return colors['vee-tint'];
  if (tone === 'warm') return colors['warm-tint'];
  return colors['surface-raised'];
}

/** The app's shared structural-card material. Caller styles come last so
 * layout concerns (width, opacity, transforms) still compose normally. */
export function RaisedView({ style, tone = 'neutral', ...props }: ViewProps & { tone?: RaisedSurfaceTone }) {
  const surface = useRaisedSurface(2);
  const backgroundColor = useToneFill(tone);
  return <View {...props} style={[surface, { backgroundColor }, style]} />;
}

/** Touchable structural card using the same material as RaisedView. */
export function RaisedTouchable({ style, tone = 'neutral', ...props }: TouchableOpacityProps & { tone?: RaisedSurfaceTone }) {
  const surface = useRaisedSurface(2);
  const backgroundColor = useToneFill(tone);
  return <TouchableOpacity {...props} style={[surface, { backgroundColor }, style]} />;
}
