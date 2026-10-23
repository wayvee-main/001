import { useColorScheme } from 'nativewind';
import { type ViewStyle } from 'react-native';

import { ELEVATION, hexToRgb } from '@/lib/tokens';
import { useThemeColors } from '@/lib/theme';

/** Theme-aware elevation. Light uses an outer shadow without a specular inset
 * so cards read as matte paper, like the stay chip. Dark keeps its depth. */
export function useElevation(level: 1 | 2 | 3 | 4 = 2): { boxShadow: string } {
  const { colorScheme } = useColorScheme();
  const colors = useThemeColors();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  if (theme === 'light' && level === 1) {
    return { boxShadow: '0 2px 7px rgba(49, 32, 57, .045)' };
  }
  const { blur, y, opacity } = ELEVATION[level];
  const [r, g, b] = hexToRgb(theme === 'light' ? colors.fg : colors['surface-sunk']);
  const shadow = `0 ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${opacity[theme]})`;
  return { boxShadow: theme === 'light' ? `0 ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${Number(opacity.light) * .75})` : shadow };
}

/** Shared neutral card/panel treatment. Inputs, controls, and semantic tinted
 * blocks intentionally use their own surface roles. */
export function useRaisedSurface(level: 1 | 2 | 3 | 4 = 1, tone: 'neutral' | 'discovery' = 'neutral'): ViewStyle {
  const colors = useThemeColors();
  const elevation = useElevation(level);
  return {
    backgroundColor: colors[tone === 'discovery' ? 'surface-discovery' : 'surface-raised'],
    borderWidth: 1,
    borderColor: colors['edge-card'],
    borderBottomColor: colors['edge-card-bottom'],
    ...elevation,
  };
}

/** One surface language for neutral, selected and primary controls. Callers
 * pair selected fills with on-selected and primary fills with on-accent. */
export function useControlSurface(selected = false, primary = false): ViewStyle {
  const { colorScheme } = useColorScheme();
  const colors = useThemeColors();
  const surface = useRaisedSurface(1);
  const fill = primary ? colors['accent-fill'] : selected ? colors['selected-surface'] : colors['surface-control'];
  return { ...surface, backgroundColor: fill,
    ...(colorScheme === 'light' ? { boxShadow: '0 2px 7px rgba(49, 32, 57, .045)' } : {}) };
}
