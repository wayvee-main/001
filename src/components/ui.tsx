import { useId, type ReactNode } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Glyph } from '@/components/glyph';
import { ICON_PATHS } from '@/lib/icons';
import { useControlSurface, useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

// ── Icons ───────────────────────────────────────────────────────────────────
// Existing Tabler path IDs resolve through the shared filled-glyph registry.
const LEGACY_GLYPHS = {
  "ticket": "ticket",
  "cutlery": "food",
  "martini": "drink",
  "trendUp": "trendUp",
  "heart": "heart",
  "sparkles": "spark",
  "luggage": "luggage",
  "card": "wallet",
  "gear": "settings",
  "help": "help",
  "qr": "qr",
  "play": "play",
  "compass": "compass",
  "lock": "lock",
  "lockOpen": "lockOpen",
  "microphone": "mic",
  "clock": "clock",
  "chevronDown": "chevronDown",
  "chevronUp": "chevronUp",
  "close": "close",
  "plus": "plus",
  "refresh": "refresh",
  "edit": "edit",
  "walk": "walk",
  "arrowUp": "arrowUp"
} as const;
const FILLED_GLYPH_FOR_PATH = new Map<string,string>(Object.entries(ICON_PATHS).map(([key,path])=>
  [path,LEGACY_GLYPHS[key as keyof typeof LEGACY_GLYPHS]]));

/** Filled glyph adapter for the established path-based API. */
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
  const glyph=FILLED_GLYPH_FOR_PATH.get(d);
  if(glyph)return <Glyph name={glyph} size={size} color={color ?? (fill==='none'?colors.ink:fill)} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke={color ?? colors.ink} strokeWidth={strokeWidth} fill={fill} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Compact filled chevrons keep the existing control dimensions. */
function FilledChevron({color,width=7,height=12,size=20,back=false}:{color:string;width?:number;height?:number;size?:number;back?:boolean}) {
  return <View style={{width,height,alignItems:'center',justifyContent:'center',transform:back?[{rotate:'180deg'}]:undefined}}>
    <Glyph name="chevron" color={color} size={size} />
  </View>;
}

export function ChevronRight({color}:{color?:string;strokeWidth?:number}) {
  const colors=useThemeColors();
  return <FilledChevron color={color ?? colors.taupe} />;
}

export function MiniChevron({color}:{color?:string}) {
  const colors=useThemeColors();
  return <FilledChevron color={color ?? colors.peach} width={5} height={9} size={15} />;
}

export function SearchIcon({size=16,color}:{size?:number;color?:string}) {
  const colors=useThemeColors();
  return <Glyph name="search" size={size} color={color ?? colors.taupe} />;
}

export function Star({size=12,color}:{size?:number;color?:string}) {
  const colors=useThemeColors();
  return <Glyph name="star" size={size} color={color ?? colors.rust} />;
}

export function Check({size=24,color}:{size?:number;color?:string}) {
  const colors=useThemeColors();
  return <View style={{width:size,height:size*2/3,alignItems:'center',justifyContent:'center'}}>
    <Glyph name="check" size={size} color={color ?? colors['on-accent']} />
  </View>;
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
  accent: { border: 'border-edge-faint', bg: 'bg-blush', text: 'text-peach' },
  success: { border: 'border-edge-faint', bg: 'bg-sage', text: 'text-pine' },
  default: { border: 'border-edge-faint', bg: 'bg-shell', text: 'text-ink' },
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
      <View className={`rounded-full border px-2 py-[3px] ${border} ${bg} shadow-soft-light dark:shadow-soft-dark`}>
        <Text className={`font-dm-medium text-[10px] ${text}`}>{label}</Text>
      </View>
    );
  }
  return (
    <View className={`self-start rounded-full border ${border} ${bg} px-2 py-[2px] shadow-soft-light dark:shadow-soft-dark`}>
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
  const surface = useControlSurface(active);
  const fg = active ? colors['on-selected'] : colors.fg;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeOpacity={0.7}
      onPress={onPress}
      style={surface}
      className={`shrink-0 flex-row items-center gap-x-1.5 rounded-full ${large ? 'px-[15px] py-2' : 'px-[13px] py-[7px]'}`}>
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
  const surface = useControlSurface(active);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeOpacity={0.7}
      onPress={onPress}
      style={surface}
      className="flex-1 min-w-[64px] items-center rounded-full px-1 py-2.5">
      <Text className={`${small ? 'text-label' : 'text-[13.5px]'} font-dm-medium ${active?'text-on-selected':'text-ink'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Full-width deep accent CTA. */
export function PrimaryButton({ label, onPress, className = '' }: { label: string; onPress?: () => void; className?: string }) {
  const surface = useControlSurface(false, true);
  return (
    <TouchableOpacity accessibilityRole="button" style={surface} activeOpacity={0.8} onPress={onPress} className={`items-center rounded-full bg-ember py-[15px] ${className} border border-edge-faint shadow-soft-light dark:shadow-soft-dark`}>
      <Text className="font-dm-medium text-[14.5px] text-on-accent">{label}</Text>
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
  const surface = useRaisedSurface(1);
  const buttonSurface = useControlSurface(false, tone === 'solid');
  const buttonTextClass = tone === 'solid' ? 'text-on-accent' : 'text-ink';
  return (
    <View
      style={surface}
      className={`items-center rounded-card ${
        compact ? 'px-5 py-6' : 'px-5 py-8'
      }`}>
      <Text className={`font-fraunces ${compact ? 'text-section' : 'text-title'} text-ink`}>{title}</Text>
      <Text className={`mt-1.5 text-center font-dm ${compact ? 'text-meta' : 'text-body'} leading-[18px] text-taupe`}>
        {message}
      </Text>
      {actionLabel ? (
        <TouchableOpacity
          activeOpacity={0.72}
          accessibilityRole="button"
          style={buttonSurface}
          onPress={onAction}
          className={`rounded-full px-4 ${compact ? 'mt-3 py-1.5' : 'mt-4 py-2.5'}`}>
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
  const surface = useControlSurface();
  const handlePress = onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  if (label) {
    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Go back, ${label}`}
        style={surface}
        className="flex-row items-center gap-x-2 rounded-full border border-edge-faint bg-shell px-3.5 py-2 shadow-soft-light dark:shadow-soft-dark">
        <FilledChevron color={colors.ink} back />
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
      style={surface}
      className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-edge-faint bg-shell shadow-soft-light dark:shadow-soft-dark">
      <FilledChevron color={colors.ink} width={8} height={14} size={22} back />
    </TouchableOpacity>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

