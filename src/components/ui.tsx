import { useId, type ReactNode } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

// ── Icons ───────────────────────────────────────────────────────────────────
// Tabler (tabler.io/icons, raw source at github.com/tabler/tabler-icons) is
// the exclusive glyph source for this app — permanent policy, not a one-off
// pass. Every icon path anywhere in the codebase, including the small
// component-local ones below, is copied from a real icon there (outline
// set unless noted) and verified against the actual SVG, not guessed or
// hand-drawn. Adding a new glyph means finding its real Tabler path first.

/** Tabler-style stroke icon: one or more subpaths in a 24×24 viewBox. */
export function Icon({
  d,
  size = 24,
  color,
  strokeWidth = 1.8,
  fill = 'none',
}: {
  d: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const colors = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color ?? colors.ink} strokeWidth={strokeWidth} fill={fill} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Tabler's chevron-right (icons/outline/chevron-right.svg), path "M9 6l6 6l-6 6",
// cropped to its own bounding box (x 9-15, y 6-18) so it still fills a compact,
// non-square render area exactly like it always has at every call site.
export function ChevronRight({ color, strokeWidth = 1.6 }: { color?: string; strokeWidth?: number }) {
  const colors = useThemeColors();
  return (
    <Svg width={7} height={12} viewBox="9 6 6 12">
      <Path d="M9 6l6 6l-6 6" stroke={color ?? colors.taupe} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MiniChevron({ color }: { color?: string }) {
  const colors = useThemeColors();
  return (
    <Svg width={5} height={9} viewBox="9 6 6 12">
      <Path d="M9 6l6 6l-6 6" stroke={color ?? colors.peach} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Tabler's search (icons/outline/search.svg): circle + handle, cropped to its
// bounding box (x 3-21, y 3-21) instead of the hand-drawn circle/line it replaces.
export function SearchIcon({ size = 16, color }: { size?: number; color?: string }) {
  const colors = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="2 2 20 20">
      <Path
        d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21l-6 -6"
        stroke={color ?? colors.taupe}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Star({ size = 12, color }: { size?: number; color?: string }) {
  const colors = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"
        fill={color ?? colors.rust}
        stroke={color ?? colors.rust}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Tabler's check (icons/outline/check.svg), path "M5 12l5 5l10 -10",
// cropped to its bounding box (x 5-20, y 7-17).
export function Check({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={(size * 2) / 3} viewBox="5 7 15 10">
      <Path d="M5 12l5 5l10 -10" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614z" />
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18z" />
      <Path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.169.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332z" />
      <Path fill="#EA4335" d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.581-2.581C13.463.891 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58z" />
    </Svg>
  );
}

// ── Placeholder imagery ─────────────────────────────────────────────────────

/** Diagonal-striped stand-in for photography, matching the design's placeholders. */
export function Stripes({
  colors,
  stripe = 6,
  radius = 9,
  style,
  children,
}: {
  colors?: [string, string];
  stripe?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const theme = useThemeColors();
  const [stripeA, stripeB] = colors ?? [theme.stripeA, theme.stripeB];
  const id = 'stripes-' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={stripe * 2} height={stripe * 2} patternTransform={`rotate(135)`}>
            <Rect width={stripe * 2} height={stripe * 2} fill={stripeA} />
            <Rect width={stripe} height={stripe * 2} fill={stripeB} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Loading placeholder — reuses Stripes' visual language (same pattern Photo
 * shows for a missing image) but means something different: "content is on
 * its way," not "no photo exists." Sized per call site (card art, a text
 * line, a whole row) rather than assuming a shape. */
export function Skeleton({ width, height, radius = 8 }: { width?: ViewStyle['width']; height: number; radius?: number }) {
  return <Stripes radius={radius} style={{ width, height }} />;
}

// ── Badges ──────────────────────────────────────────────────────────────────

const BADGE_TONES = {
  accent: { border: 'border-[rgba(69,201,194,0.35)]', bg: 'bg-blush', text: 'text-peach' },
  success: { border: 'border-[rgba(97,199,154,0.35)]', bg: 'bg-sage', text: 'text-pine' },
  default: { border: 'border-sand', bg: 'bg-shell', text: 'text-ink' },
} as const;

/** Small filled pill. `eyebrow` (uppercase, bold, on poster/card art) and
 * `status` (bordered, on a photo hero or badge list) were two different
 * hand-rolled shapes for the same idea — this is both, picked by variant. */
export function Badge({
  label,
  tone = 'accent',
  variant = 'eyebrow',
}: {
  label: string;
  tone?: keyof typeof BADGE_TONES;
  variant?: 'eyebrow' | 'status';
}) {
  const { border, bg, text } = BADGE_TONES[tone];
  if (variant === 'status') {
    return (
      <View className={`rounded-full border px-2 py-[3px] ${border} ${bg}`}>
        <Text className={`font-dm-medium text-[10px] ${text}`}>{label}</Text>
      </View>
    );
  }
  return (
    <View className={`self-start rounded-full ${bg} px-2 py-[2px]`}>
      <Text numberOfLines={1} className={`font-dm-bold text-[8.5px] tracking-[0.3px] ${text}`}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ── Buttons & chips ─────────────────────────────────────────────────────────

/** Rounded selectable pill (cuisine chips, category chips). */
export function Chip({
  label,
  active = false,
  onPress,
  iconD,
  large = false,
  surface = 'default',
  raised = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  iconD?: string;
  large?: boolean;
  surface?: 'default' | 'shell';
  raised?: boolean;
}) {
  const colors = useThemeColors();
  const raisedSurface = useRaisedSurface(1);
  const fg = active ? colors.peach : colors.ink;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeOpacity={0.7}
      onPress={onPress}
      style={raised ? raisedSurface : undefined}
      className={`shrink-0 flex-row items-center gap-x-1.5 rounded-full border ${large ? 'px-[15px] py-2' : 'px-[13px] py-[7px]'} ${
        active ? `${surface === 'shell' ? 'bg-shell' : 'bg-blush'} border-rust` : 'bg-shell border-sand'
      }`}>
      {iconD ? <Icon d={iconD} size={large ? 15 : 13} color={fg} strokeWidth={2} /> : null}
      <Text style={{ color: fg }} className={`font-dm-medium ${large ? 'text-label' : 'text-label'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Equal-width selectable option (party size, dates, times, sort, price…). */
export function OptionPill({
  label,
  active = false,
  onPress,
  small = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`flex-1 min-w-[64px] items-center rounded-control border px-1 py-2.5 ${
        active ? 'bg-coral-50 border-sand' : 'bg-shell border-sand'
      }`}>
      <Text className={`${small ? 'text-label' : 'text-[13.5px]'} font-dm-medium text-ink`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Full-width deep accent CTA. */
export function PrimaryButton({ label, onPress, className = '' }: { label: string; onPress?: () => void; className?: string }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} className={`items-center rounded-full bg-ember py-[15px] ${className}`}>
      <Text className="font-dm-medium text-[14.5px] text-white">{label}</Text>
    </TouchableOpacity>
  );
}

/** Bordered title/message card for "nothing here yet" and "this couldn't be
 * found" screens — the same shape was hand-rolled with drifting sizes across
 * saved, following, plans, crawl/event/pick not-found, and the food hub's
 * "no matches" state. `compact` matches the smaller inline variant (food hub
 * filters); default matches the full-page variant (empty lists, 404s). */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  tone = 'outline',
  tint = false,
  compact = false,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'solid' | 'outline' | 'subtle';
  tint?: boolean;
  compact?: boolean;
}) {
  const surface = useRaisedSurface(2);
  const buttonClass =
    tone === 'solid'
      ? 'bg-ember'
      : tone === 'subtle'
        ? 'border border-sand bg-shell'
        : 'border border-rust bg-blush';
  const buttonTextClass = tone === 'solid' ? 'text-white' : 'text-peach';
  return (
    <View
      style={tint ? undefined : surface}
      className={`items-center rounded-card ${tint ? 'border border-sand bg-coral-50' : ''} ${
        compact ? 'px-5 py-6' : 'px-5 py-8'
      }`}>
      <Text className={`font-fraunces ${compact ? 'text-section' : 'text-title'} text-ink`}>{title}</Text>
      <Text className={`mt-1.5 text-center font-dm ${compact ? 'text-meta' : 'text-body'} leading-[18px] text-taupe`}>
        {message}
      </Text>
      {actionLabel ? (
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={onAction}
          className={`rounded-full px-4 ${compact ? 'mt-3 py-1.5' : 'mt-4 py-2.5'} ${buttonClass}`}>
          <Text className={`font-dm-medium ${compact ? 'text-meta' : 'text-label'} ${buttonTextClass}`}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Round bordered back button with optional label support. */
export function BackButton({ label, onPress }: { label?: string; onPress?: () => void }) {
  const router = useRouter();
  const colors = useThemeColors();
  const handlePress = onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  if (label) {
    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Go back, ${label}`}
        className="flex-row items-center gap-x-2 rounded-full border border-sand bg-shell px-3.5 py-2 shadow-2xs">
        <Svg width={7} height={12} viewBox="0 0 8 14">
          <Path d="M7 1L1 7l6 6" stroke={colors.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text className="font-dm-medium text-label text-ink">{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sand bg-shell shadow-2xs">
      <Svg width={8} height={14} viewBox="0 0 8 14">
        <Path d="M7 1L1 7l6 6" stroke={colors.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

