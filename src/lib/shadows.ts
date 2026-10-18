import { useColorScheme } from 'nativewind';
import { type ViewStyle } from 'react-native';

import { ELEVATION, hexToRgb } from '@/lib/tokens';
import { useThemeColors } from '@/lib/theme';

/** Theme-aware elevation. Light derives a neutral shadow from the ink; dark
 * uses the deepest surface so elevation reads as depth instead of a pale halo. */
export function useElevation(level: 1 | 2 | 3 | 4 = 2): { boxShadow: string } {
  const { colorScheme } = useColorScheme();
  const colors = useThemeColors();
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const { blur, y, opacity } = ELEVATION[level];
  const [r, g, b] = hexToRgb(theme === 'light' ? colors.fg : colors['surface-sunk']);
  return { boxShadow: `0 ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${opacity[theme]})` };
}

/** Shared neutral card/panel treatment. Inputs, controls, and semantic tinted
 * blocks intentionally use their own surface roles. */
export function useRaisedSurface(level: 1 | 2 | 3 | 4 = 1, tone: 'neutral' | 'discovery' = 'neutral'): ViewStyle {
  const colors = useThemeColors();
  const elevation = useElevation(level);
  return {
    backgroundColor: colors[tone === 'discovery' ? 'surface-discovery' : 'surface-raised'],
    borderWidth: 1,
    borderColor: colors['edge-faint'],
    ...elevation,
  };
}

/** One surface language for neutral, selected and primary controls. Callers
 * pair selected fills with on-selected and primary fills with on-accent. */
export function useControlSurface(selected = false, primary = false): ViewStyle {
  const colors = useThemeColors();
  const surface = useRaisedSurface(1);
  const fill = primary ? colors['accent-fill'] : selected ? colors['selected-surface'] : colors['surface-raised'];
  return { ...surface, backgroundColor: fill, borderColor: primary || selected ? fill : colors['edge-faint'] };
}
