import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { ListRow } from '@/components/list-row';
import { RaisedView } from '@/components/raised-surface';
import { useThemeColors } from '@/lib/theme';

export { FactStrip, type HubFact } from '@/components/fact-strip';

/** Single listing-row shape shared by every source in the food hub (curated
 * restaurants, Overture/OSM-backed places) so no two rows can look different. */
export function FoodHubRow({
  name,
  image,
  cue,
  meta,
  tasteTag,
  last = false,
  onPress,
}: {
  name: string;
  image?: string;
  cue?: string;
  meta?: string;
  tasteTag?: string;
  last?: boolean;
  onPress: () => void;
}) {
  return <ListRow image={image} title={name} badge={cue} meta={meta} tasteTag={tasteTag} divider={!last} onPress={onPress} />;
}

/** A pick-one control wearing Home's "Link your stay" chip: marigold tint under
 * a dashed fg-muted edge. The dash is not decoration — in this codebase it
 * means "a slot with nothing in it yet" (home-top.tsx, and the empty states in
 * plan/profile/answer), which is exactly what an unset filter is. It goes solid
 * the moment something fills the slot. */
export function HubDropdown({
  glyph,
  label,
  chosen,
  open,
  onPress,
}: {
  glyph: string;
  label: string;
  chosen: boolean;
  open: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const tint = chosen ? colors['fg-accent'] : colors['fg-muted'];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ expanded: open, selected: chosen }}
      accessibilityLabel={chosen ? `${label}. Change` : label}
      activeOpacity={0.74}
      onPress={onPress}
      style={chosen ? undefined : { backgroundColor: colors['warm-tint'] }}
      className={`h-9 shrink-0 flex-row items-center gap-x-1.5 rounded-full border px-3 ${
        chosen ? 'border-rust bg-blush' : 'border-dashed border-fg-muted'
      }`}>
      <Glyph name={glyph} size={13} color={tint} strokeWidth={1.9} />
      <Text numberOfLines={1} style={{ color: chosen ? colors['fg-accent'] : colors.ink }} className="font-dm-medium text-label">
        {label}
      </Text>
      {/* No chevron-down in the Tabler set the app ships; the right-facing one
          turned a quarter is the same glyph rather than a second drawing. */}
      <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
        <Glyph name="chevron" size={13} color={tint} strokeWidth={1.9} />
      </View>
    </TouchableOpacity>
  );
}

export type HubOption = { label: string; value: string | null; count?: number };

/** The dropdown's list, opened inline beneath the control row rather than
 * floating over it: the row is a horizontal scroller, and anything absolutely
 * positioned inside one gets clipped by it. Pushing the results down instead
 * costs a little motion and never loses the menu. */
export function HubMenu({
  options,
  value,
  onSelect,
}: {
  options: HubOption[];
  value: string | null;
  onSelect: (value: string | null) => void;
}) {
  const colors = useThemeColors();
  return (
    <RaisedView className="overflow-hidden rounded-control">
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            activeOpacity={0.7}
            onPress={() => onSelect(option.value)}
            className={`flex-row items-center justify-between px-3.5 py-3 ${index ? 'border-t border-sand' : ''}`}>
            <Text style={active ? { color: colors['fg-accent'] } : undefined} className="font-dm-medium text-label text-ink">
              {option.label}
            </Text>
            {active ? (
              <Glyph name="check" size={14} color={colors['fg-accent']} strokeWidth={2} />
            ) : option.count != null ? (
              <Text className="font-dm text-meta text-taupe">{option.count}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </RaisedView>
  );
}
