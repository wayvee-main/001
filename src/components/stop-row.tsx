// One stop in a night, as a row.
//
// It was a rail: a 28 pt kind-coloured node, a hairline connector carrying the
// walk leg on a floating chip, and each stop in its own raised card with an
// outline pill at the right. Three idioms that appeared here and nowhere else
// in the app, which is most of why the plan screens read as a different
// product from the detail screens.
//
// This is the shape every other list already has — the venue's What's on, the
// food hub, a collection's picks: one RaisedView, hairline dividers, a round
// glyph chip, a kicker, a name, a meta line. The walk leg moves into the meta
// of the stop it leads to ("8 min walk from dinner"), where it is a fact about
// that stop rather than decoration on a connector.

import { Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import type { Restaurant } from '@/lib/data';
import { ICON_PATHS } from '@/lib/icons';
import { useThemeColors } from '@/lib/theme';

/** Per-kind glyph and tint, so a stop reads as "what it is" before it is read
 * at all. The same three-way split the rail had. */
const STOP_KIND = {
  event: { icon: ICON_PATHS.ticket, tint: 'bg-blush', fg: 'rust' as const },
  dinner: { icon: ICON_PATHS.cutlery, tint: 'bg-sage', fg: 'pine' as const },
  nightlife: { icon: ICON_PATHS.martini, tint: 'bg-warm-tint', fg: 'peach' as const },
};

/** How a stop is named when the *next* stop reports the walk from it —
 * "8 min walk from dinner". Lives here because both plan screens phrase it. */
export const STOP_NOUN: Record<'event' | 'dinner' | 'nightlife', string> = {
  dinner: 'dinner',
  event: 'the show',
  nightlife: 'the nightcap',
};

export function StopRow({
  kind,
  time,
  title,
  subtitle,
  reasonLabel,
  actionLabel,
  onAction,
  onPress,
  legLabel,
  locked,
  onToggleLock,
  last = false,
}: {
  kind: 'event' | 'dinner' | 'nightlife';
  time: string;
  title: string;
  subtitle: string;
  /** Short, factual "why this" line — a computed reason from plan-engine
   * (distance, taste match, open-till, weather), never generated prose. */
  reasonLabel?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  onPress?: () => void;
  /** The walk from the previous stop. Rendered as part of this stop's meta,
   * because that is whose journey it is. */
  legLabel?: string | null;
  locked?: boolean;
  onToggleLock?: () => void;
  last?: boolean;
}) {
  const colors = useThemeColors();
  const style = STOP_KIND[kind];
  // Only the info block is pressable when onPress is set: keeping the lock and
  // action as siblings rather than descendants avoids nesting a button inside
  // a button (invalid on web, and a hydration error with it).
  const Info = onPress ? TouchableOpacity : View;
  const meta = [subtitle, legLabel].filter(Boolean).join(' · ');

  return (
    <View className={`flex-row items-center gap-x-3 py-3 ${last ? '' : 'border-b border-sand'}`}>
      <View className={`h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.tint}`}>
        <Icon d={style.icon} size={15} color={colors[style.fg]} strokeWidth={1.9} />
      </View>

      <Info
        {...(onPress ? { accessibilityRole: 'button' as const, accessibilityLabel: `${title}, ${time}`, activeOpacity: 0.75, onPress } : {})}
        className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-dm-bold text-micro uppercase tracking-[0.5px] text-peach">{time}</Text>
        <Text numberOfLines={1} className="font-dm-bold text-body text-ink">{title}</Text>
        {meta ? <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{meta}</Text> : null}
        {reasonLabel ? (
          <View className="mt-0.5 flex-row items-center gap-x-1">
            <Icon d={ICON_PATHS.sparkles} size={10} color={colors.pine} strokeWidth={2} />
            <Text numberOfLines={1} className="min-w-0 flex-1 font-dm-medium text-micro text-pine">{reasonLabel}</Text>
          </View>
        ) : null}
      </Info>

      {onToggleLock ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={locked ? `Unlock ${title}` : `Lock ${title} so Regenerate skips it`}
          activeOpacity={0.72}
          onPress={onToggleLock}
          className={`h-8 w-8 shrink-0 items-center justify-center rounded-full ${locked ? 'bg-blush' : 'bg-surface'}`}>
          <Icon d={locked ? ICON_PATHS.lock : ICON_PATHS.lockOpen} size={13} color={locked ? colors.rust : colors.taupe} strokeWidth={1.9} />
        </TouchableOpacity>
      ) : null}

      {actionLabel ? (
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel={`${actionLabel} ${title}`}
          activeOpacity={0.75}
          onPress={onAction}
          className="shrink-0 rounded-full border border-rust px-3 py-1.5">
          <Text className="font-dm-medium text-meta text-rust">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function dinnerAction(restaurant: Restaurant): { label: string; url: string } {
  if (restaurant.reserveUrl) return { label: 'Reserve', url: restaurant.reserveUrl };
  if (restaurant.orderUrl) return { label: 'Order', url: restaurant.orderUrl };
  return { label: restaurant.primaryAction.label, url: restaurant.primaryAction.url };
}
