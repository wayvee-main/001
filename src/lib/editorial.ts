import { useWindowDimensions } from 'react-native';

import { hexToRgb } from '@/lib/tokens';
import { useThemeColors } from '@/lib/theme';

/** Font files are bundled by RootLayout, including the reference's 600 weight. */
export const EDITORIAL_FONTS = {
  display: 'Fraunces_500Medium',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  strong: 'DMSans_600SemiBold',
} as const;

/** Exact, scoped light/dark colors and responsive sizes from approved Editorial. */
export function useEditorial() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const compact = width <= 400;
  const c = {
    paper: colors['editorial-paper'], ink: colors['editorial-ink'],
    muted: colors['editorial-muted'], surface: colors['editorial-surface'],
    soft: colors['editorial-soft'], line: colors['editorial-line'],
    coral: colors['editorial-coral'], fill: colors['editorial-fill'],
    onFill: colors['editorial-on-fill'], violet: colors['editorial-violet'],
    dark: colors['editorial-dark'], onDark: colors['editorial-on-dark'],
    darkMuted: colors['editorial-dark-muted'],
  };
  const dark = c.paper === '#17131B';
  const [r, g, b] = hexToRgb(colors['editorial-shadow']);
  const [pr, pg, pb] = hexToRgb(colors['editorial-photo-shade']);
  return {
    c, compact, gutter: compact ? 16 : 20,
    heroSize: compact ? 33 : 36,
    searchShadow: `0 4px 12px rgba(${r},${g},${b},${dark ? 0.208 : 0.094})`,
    photoShade: `rgba(${pr},${pg},${pb},${dark ? 0.87 : 0.855})`,
  };
}
