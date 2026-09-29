// What a guest does with a night, once they have one.
//
// /plan and /plan-draft both ended a night with the same two buttons —
// "Save dinner" and "Add event" — written out twice, and both carried the same
// bug: the pair sat in a flex-row with `flex-1` on each child, so a plan with
// only dinner (the common local-fallback case) stretched one pale pill edge to
// edge. On /plan it landed directly under the Refine ghost, which is the same
// shape and the same weight, and neither read as the thing to press.
//
// So: one row, and one definition. The leading slot is /plan's Refine, sized
// to its own label rather than to the screen; the save targets share what is
// left. The last target is filled and the ones before it are ghosts, which
// makes the row read left to right as "change this / commit to this" whether
// there are one or two of them.

import { Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { useThemeColors } from '@/lib/theme';

/** One save target: what it is now, and what pressing it does. `done` drives
 * both the label and the fill, so a saved dinner and an added event report
 * themselves the same way. */
export interface PlanAction {
  label: string;
  doneLabel: string;
  done: boolean;
  icon: string;
  onPress: () => void;
}

function ActionButton({ action, filled }: { action: PlanAction; filled: boolean }) {
  const colors = useThemeColors();
  // Filled is the commitment; a done filled button goes pine, the same green
  // every "this is real and confirmed" state in the app uses.
  const tone = filled
    ? action.done
      ? 'bg-pine'
      : 'bg-ember'
    : action.done
      ? 'border border-rust bg-blush'
      : 'border border-sand bg-shell';
  const fg = filled ? '#FFFFFF' : colors.peach;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: action.done }}
      activeOpacity={0.72}
      onPress={action.onPress}
      className={`h-11 min-w-0 flex-1 flex-row items-center justify-center gap-x-2 rounded-full ${tone}`}>
      <Icon d={action.icon} size={15} color={fg} fill={!filled && action.done ? fg : 'none'} />
      <Text numberOfLines={1} className={`font-dm-medium text-label ${filled ? 'text-white' : 'text-ink'}`}>
        {action.done ? action.doneLabel : action.label}
      </Text>
    </TouchableOpacity>
  );
}

export function PlanFooter({
  leading,
  actions,
}: {
  /** A secondary control that belongs with these — /plan's "Refine". It keeps
   * its label's width while there is anything to save, and only takes the row
   * when there is not. */
  leading?: { label: string; icon: string; onPress: () => void } | null;
  /** In the order they should be pressed. The last one is the commitment. */
  actions: PlanAction[];
}) {
  const colors = useThemeColors();
  if (!leading && !actions.length) return null;
  return (
    <View className="flex-row gap-x-2">
      {leading ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={leading.onPress}
          className={`h-11 flex-row items-center justify-center gap-x-2 rounded-full border border-sand bg-shell ${
            actions.length ? 'shrink-0 px-4' : 'flex-1'
          }`}>
          <Icon d={leading.icon} size={15} color={colors.rust} strokeWidth={2} />
          <Text numberOfLines={1} className="font-dm-bold text-label text-rust">{leading.label}</Text>
        </TouchableOpacity>
      ) : null}
      {actions.map((action, index) => (
        <ActionButton key={action.label} action={action} filled={index === actions.length - 1} />
      ))}
    </View>
  );
}

/** The two targets a night can have, built from whatever the plan actually
 * holds. Callers pass their own handlers — /plan records an accept signal
 * alongside the toggle and /plan-draft does not — but the labels and icons
 * are the same fact on both screens, so they live here. */
export function saveDinnerAction(saved: boolean, onPress: () => void): PlanAction {
  return { label: 'Save dinner', doneLabel: 'Dinner saved', done: saved, icon: ICON_PATHS.heart, onPress };
}

export function addEventAction(added: boolean, onPress: () => void): PlanAction {
  return { label: 'Add event', doneLabel: 'Event added', done: added, icon: ICON_PATHS.ticket, onPress };
}
