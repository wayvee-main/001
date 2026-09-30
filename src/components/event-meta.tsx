// Event card metadata, shared by every surface that lists an event: Home's
// hero card, Home's row, and Discover's row.
//
// It lives here because those three drifted before. They each built their own
// dot-separated string, and the day/time/venue/travel line grew a fourth fact
// on all three independently until none of them fit. One component means the
// next change lands everywhere at once.
//
// Glyphs instead of separators: a middle dot weights every fact the same and
// costs a character each, where a clock and a pin let the eye go straight to
// the one it wants.

import { Text, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { useThemeColors } from '@/lib/theme';

/** A price worth printing, or a ticket affordance.
 *
 * Listings carry either a real price ("$40", "$89–$129", "Free") or boilerplate
 * standing in for one ("See tickets", "Official tickets"). The first is
 * information; the second is the longest string in the title row and says
 * nothing the tappable row and its chevron do not already say. Digits are the
 * test rather than a "$" prefix, so a listing that prices itself some other way
 * still reads as a price. */
export function isPrintablePrice(label: string): boolean {
  const trimmed = label.trim();
  return /\d/.test(trimmed) || /^free$/i.test(trimmed);
}

export function EventPrice({ label }: { label: string }) {
  const colors = useThemeColors();
  const trimmed = label.trim();

  if (isPrintablePrice(trimmed)) {
    return <Text numberOfLines={1} className="shrink-0 font-dm-medium text-[10.5px] text-pine">{trimmed}</Text>;
  }

  // The words are gone from the screen but not from a screen reader.
  return (
    <View accessible accessibilityLabel={trimmed} className="shrink-0">
      <Glyph name="ticket" size={13} color={colors.pine} strokeWidth={1.7} />
    </View>
  );
}

/** When and where, each behind its own glyph.
 *
 * `when` is optional: the hero card states the day and time in the badge over
 * its photo, so repeating it underneath would be the same fact twice. */
export function EventMetaLine({ when, venue }: { when?: string; venue: string }) {
  const colors = useThemeColors();
  return (
    <View className="mt-0.5 flex-row items-center gap-x-2.5">
      {when ? (
        <View className="shrink-0 flex-row items-center gap-x-1">
          <Glyph name="clock" size={11} color={colors.taupe} strokeWidth={1.7} />
          <Text numberOfLines={1} className="font-dm text-meta text-taupe">{when}</Text>
        </View>
      ) : null}
      {/* The venue is the fact most often too long, so it is the one that
          shrinks — the time beside it never truncates. */}
      <View className="min-w-0 shrink flex-row items-center gap-x-1">
        <Glyph name="pin" size={11} color={colors.taupe} strokeWidth={1.7} />
        <Text numberOfLines={1} className="shrink font-dm text-meta text-taupe">{venue}</Text>
      </View>
    </View>
  );
}
