// One adjustable constraint, as a pill and a rail.
//
// This was the composer's, written inline in create.tsx: three small pills
// carrying Vee's assumptions — start time, budget, walk budget — each opening
// a raised rail of options underneath. It works because it says what the
// assumption *is* without spending a heading on it, which is the note
// create.tsx left when the row replaced five stacked segmented controls:
// "five pill controls made the assumptions look like the point of the screen."
//
// The builder has the same problem and three more values (pace, budget, vibe),
// so this is the one definition rather than a second copy. The state, the
// motion and the reduced-motion check come with it — a screen that imports
// only the pill and rewrites the open/close behaviour is how the two drift.

import { useEffect, useState } from 'react';
import { Animated, Easing, LayoutAnimation, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { useReducedMotionPreference } from '@/lib/motion';
import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

/** One option on an open rail. `key` only has to be unique within its rail. */
export interface ConstraintOption {
  key: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

/** An entry point for one adjustable constraint. The current value remains
 * available to assistive technology and in the opened rail. */
export function MetaValue({
  constraint,
  glyph,
  label,
  spokenLabel,
  onPress,
}: {
  constraint: string;
  glyph: string;
  label: string;
  /** What a screen reader hears in place of `label`, when the pill is showing
   * a summary of several choices rather than the choices themselves. */
  spokenLabel?: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Change ${constraint}, currently ${spokenLabel ?? label}`}
      activeOpacity={0.6}
      hitSlop={8}
      onPress={onPress}
      style={{ backgroundColor: colors['surface-soft'], borderColor: colors['edge-soft'], borderWidth: StyleSheet.hairlineWidth }}
      className="h-8 shrink-0 flex-row items-center gap-x-1.5 rounded-full px-2.5">
      <Glyph name={glyph} size={13} color={colors['fg-muted']} strokeWidth={1.7} />
      {/* The value, not just the icon. Three bare glyphs read as unlabelled
       * buttons; the point of surfacing these was that a guest can see what Vee
       * is assuming without opening anything. */}
      <Text numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }} className="font-dm-bold text-meta text-ink">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** The open rail. Horizontal rather than wrapped: the options for one
 * constraint are a single comparable set, and a set that reflows to two lines
 * has started to look like a form. */
export function ConstraintRail({
  options,
  motion,
  onChoose,
}: {
  options: ConstraintOption[];
  /** 0 → 1, from `useConstraintPicker`. */
  motion: Animated.Value;
  /** Called after an option's own `onSelect`, so the owner can close the rail.
   * Multi-select constraints pass a no-op and stay open. */
  onChoose: () => void;
}) {
  const colors = useThemeColors();
  const raisedSurface = useRaisedSurface(2);
  return (
    <Animated.View
      style={{
        opacity: motion,
        transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [-5, 0] }) }],
      }}>
      <View style={raisedSurface} className="rounded-2xl py-2">
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 6 }}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: option.selected }}
              activeOpacity={0.72}
              onPress={() => {
                option.onSelect();
                onChoose();
              }}
              style={{
                backgroundColor: option.selected ? colors['vee-tint'] : colors['surface-soft'],
                borderColor: option.selected ? colors['vee-strong'] : colors['edge-soft'],
                borderWidth: StyleSheet.hairlineWidth,
              }}
              className="h-9 items-center justify-center rounded-full px-3">
              <Text style={{ color: option.selected ? colors['vee-strong'] : colors.fg }} className="font-dm-medium text-meta">
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Animated.View>
  );
}

/** Which rail is open, and the value that fades it in. One at a time: two open
 * rails is a form again. */
export function useConstraintPicker<Key extends string>() {
  const reduceMotion = useReducedMotionPreference();
  const [open, setOpen] = useState<Key | null>(null);
  const [motion] = useState(() => new Animated.Value(0));

  const toggle = (key: Key) => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((current) => (current === key ? null : key));
  };

  const close = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(null);
  };

  useEffect(() => {
    const value = open ? 1 : 0;
    if (reduceMotion) {
      motion.setValue(value);
      return;
    }
    const animation = Animated.timing(motion, {
      toValue: value,
      duration: value ? 210 : 130,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [open, motion, reduceMotion]);

  return { open, toggle, close, motion };
}

/** Convenience for the common shape: a single-select constraint over a list of
 * literal values, where the label is the value. */
export function literalOptions<T extends string>(
  values: readonly T[],
  current: T,
  onSelect: (value: T) => void,
): ConstraintOption[] {
  return values.map((value) => ({
    key: value,
    label: value,
    selected: value === current,
    onSelect: () => onSelect(value),
  }));
}
