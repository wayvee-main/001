/* GENERATED FILE — edit src/lib/tokens.ts and run `npm run tokens`, do not hand-edit. */
import { useColorScheme } from 'nativewind';

/** Mirrors the CSS-variable pairs in src/global.css ("Vee Coral" palette) — kept
 * here as plain hex because inline color props (Icon, placeholderTextColor,
 * SVG fills, shadow colors) can't read Tailwind's CSS variables the way
 * className does. Both semantic role names (bg, fg, accent, ...) and legacy
 * hue-named aliases (cream, ink, rust, ...) resolve to the same hex — reach
 * for the semantic name in new code. Source: src/lib/tokens.ts. */
const PALETTE = {
  light: {
    bg: "#FFFDFA",
    surface: "#F0EBE3",
    "surface-raised": "#FFFDFA",
    "surface-soft": "#FBF8F4",
    "surface-sunk": "#E7E0D6",
    fg: "#2A1B33",
    "fg-muted": "#716672",
    "fg-accent": "#A14325",
    accent: "#E45526",
    "accent-fill": "#E85D2C",
    "on-accent": "#FFFFFF",
    open: "#38714F",
    warm: "#FFC757",
    "warm-strong": "#543F18",
    vee: "#6F5BD1",
    "vee-strong": "#5D4BAA",
    "accent-tint": "#FBE4DA",
    "warm-tint": "#FFF3D8",
    "vee-tint": "#E3DFF7",
    danger: "#C93537",
    edge: "rgba(42, 27, 51, 0.12)",
    "edge-soft": "rgba(42, 27, 51, 0.08)",
    cream: "#FFFDFA",
    ink: "#2A1B33",
    taupe: "#716672",
    shell: "#FFFDFA",
    rust: "#E45526",
    ember: "#E85D2C",
    peach: "#A14325",
    pine: "#38714F",
    ochre: "#FFC757",
    coralDark: "#543F18",
    sand: "rgba(42, 27, 51, 0.12)",
    sand2: "rgba(42, 27, 51, 0.08)",
    stripeA: "#EDE7DE",
    stripeB: "#E2DAD0",
  },
  dark: {
    bg: "#151117",
    surface: "#251E29",
    "surface-raised": "#1B161E",
    "surface-soft": "#372E3C",
    "surface-sunk": "#100D13",
    fg: "#FFFDFA",
    "fg-muted": "#B8AAB5",
    "fg-accent": "#FF9271",
    accent: "#FF9271",
    "accent-fill": "#E85D2C",
    "on-accent": "#FFFFFF",
    open: "#83D0A8",
    warm: "#FFC757",
    "warm-strong": "#3D2D10",
    vee: "#A896FF",
    "vee-strong": "#C5BAFF",
    "accent-tint": "#4A2A25",
    "warm-tint": "#403321",
    "vee-tint": "#352C4D",
    danger: "#FF6B6D",
    edge: "rgba(255, 253, 250, 0.12)",
    "edge-soft": "rgba(255, 253, 250, 0.08)",
    cream: "#151117",
    ink: "#FFFDFA",
    taupe: "#B8AAB5",
    shell: "#1B161E",
    rust: "#FF9271",
    ember: "#E85D2C",
    peach: "#FF9271",
    pine: "#83D0A8",
    ochre: "#FFC757",
    coralDark: "#3D2D10",
    sand: "rgba(255, 253, 250, 0.12)",
    sand2: "rgba(255, 253, 250, 0.08)",
    stripeA: "#241D27",
    stripeB: "#2E2633",
  },
  // Fixed across both themes.
  forest: "#24463B",
  night: "#2A1B33",
  blush: "rgba(232,93,44,0.14)",
  blush2: "rgba(232,93,44,0.09)",
  sage: "rgba(59,119,86,0.13)",
  mist: "rgba(42,27,51,0.4)",
  apricot: "rgba(255,199,87,0.20)",
  "coral-50": "rgba(232,93,44,0.11)",
} as const;

export type ThemeColors = Record<
  keyof typeof PALETTE.light | "forest" | "night" | "blush" | "blush2" | "sage" | "mist" | "apricot" | "coral-50",
  string
>;

/** Current theme's resolved hex values, for the inline color props className
 * can't reach. Falls back to dark if the system scheme is unavailable. */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  const base = colorScheme === 'light' ? PALETTE.light : PALETTE.dark;
  return {
    ...base,
    forest: PALETTE["forest"],
    night: PALETTE["night"],
    blush: PALETTE["blush"],
    blush2: PALETTE["blush2"],
    sage: PALETTE["sage"],
    mist: PALETTE["mist"],
    apricot: PALETTE["apricot"],
    "coral-50": PALETTE["coral-50"],
  };
}
