// Shared "reach the planner" affordances for detail/Discover screens. Every
// item routes to the same real concierge pipeline (/create -> plan-engine) —
// these are just the two shapes that CTA takes: a full-width bottom-bar
// button on a detail screen, or a small inline pill on a Discover row.
import { Text, TouchableOpacity } from 'react-native';

import { Icon } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { useThemeColors } from '@/lib/theme';

/** Bottom-bar secondary CTA — "Plan a night around this" — for detail screens
 * whose primary action is something else (official calendar, booking, a
 * route). Anchors the concierge ask to this item via onPress, which callers
 * build from /create's own eventId/restaurantId/nightlifeId/venueId/crawlId
 * params (see lib/concierge/adapter.ts's ConciergeContext). */
export function PlanCta({ label = 'Plan a night around this', onPress }: { label?: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={onPress}
      className="h-11 flex-row items-center justify-center gap-x-1.5 rounded-full border border-accent/40 bg-surface">
      <Icon d={ICON_PATHS.sparkles} size={14} color={colors.accent} strokeWidth={2} />
      <Text className="font-dm-bold text-[12.5px] text-peach">{label}</Text>
    </TouchableOpacity>
  );
}

/** Small inline pill for Discover/Home rows — same visual as the one
 * TrendingEventRow already used for events, generalized so every row kind
 * (venue, nightlife, route) can reach the concierge the same way. */
export function PlanChip({ onPress }: { onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Plan a night around this"
      activeOpacity={0.75}
      onPress={onPress}
      className="flex-row items-center gap-x-1 rounded-full border border-sand bg-coral-50 px-2.5 py-1.5 shadow-2xs">
      <Icon d={ICON_PATHS.sparkles} size={11} color={colors.rust} strokeWidth={2} />
      <Text className="font-dm-bold text-[11px] text-rust">Plan</Text>
    </TouchableOpacity>
  );
}
