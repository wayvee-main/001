import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { MiniChevron } from '@/components/ui';
import { Photo } from '@/components/photo';
import { useThemeColors, type ThemeColors } from '@/lib/theme';

export type CountTile = {
  key: string;
  /** Already formatted: some counts are exact, others are a catalog size. */
  count: string;
  label: string;
  hint: string;
  tint: keyof ThemeColors;
  ink: keyof ThemeColors;
  glyph: GlyphName;
  onPress: () => void;
};

/** Home's "Around you" grid.
 *
 * Four counts off the four pools the rest of Home is drawn from — kitchens,
 * dated events, the nightlife catalog and the crawls. Each number is the one
 * the section below it would show, so the grid can never disagree with the
 * lists; and each tile opens the pool it counted, because a quantity the guest
 * cannot follow is decoration (CLAUDE.md #3).
 *
 * The glyph is small and paired with the count. An oversized one, and later a
 * photograph behind the text, both became the loudest thing on a tile whose
 * point is a number. Flat tint, one glyph, one number. */
export function AroundYou({ tiles }: { tiles: CountTile[] }) {
  const colors = useThemeColors();
  const rows: CountTile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <View className="gap-y-2.5">
      {rows.map((row) => (
        <View key={row.map((tile) => tile.key).join('-')} className="flex-row gap-x-2.5">
          {row.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              accessibilityRole="button"
              accessibilityLabel={`${tile.count} ${tile.label}, ${tile.hint}`}
              activeOpacity={0.78}
              onPress={tile.onPress}
              style={{
                backgroundColor: colors[tile.tint],
                borderColor: colors['edge-soft'],
                borderWidth: StyleSheet.hairlineWidth,
              }}
              className="min-h-[86px] flex-1 rounded-panel px-3.5 pb-3.5 pt-3">
              {/* Glyph and count read as one mark, so they sit together
               * rather than at opposite corners of the tile. */}
              <View className="flex-row items-center gap-x-2">
                <Glyph name={tile.glyph} size={15} color={colors[tile.ink]} strokeWidth={1.9} />
                <Text
                  style={{ color: colors[tile.ink], fontVariant: ['tabular-nums'] }}
                  className="font-fraunces text-[23px] leading-[27px]">
                  {tile.count}
                </Text>
              </View>
              <Text numberOfLines={1} className="mt-1 font-dm-medium text-body text-ink">{tile.label}</Text>
              <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{tile.hint}</Text>
            </TouchableOpacity>
          ))}
          {/* An odd count would otherwise stretch the last tile to full width. */}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

/** The screen's second-level heading: a named group of sections. Sits a step
 * below the page title (19px) and well under the 26–28px heroes Home used to
 * lead every rail with, so three of these read as structure rather than as
 * three competing titles. The rule above it does the separating; the name only
 * has to say which group this is. */
export function Umbrella({ title }: { title: string }) {
  const colors = useThemeColors();
  return (
    <View
      style={{ borderTopColor: colors.edge, borderTopWidth: StyleSheet.hairlineWidth }}
      className="pt-3.5">
      <Text className="font-fraunces text-section text-ink">{title}</Text>
    </View>
  );
}

/** The third level of Home's hierarchy: page title (19) › umbrella (17) ›
 * this. Small caps rather than a size step, because another serif heading
 * here is what made the old Home read as four competing titles. */
export function SubLabel({
  title,
  action,
  onPress,
}: {
  title: string;
  /** Wording for the way through. Omit it and the control is a chevron — the
   * same mark every tappable row on Home ends in, which says "there is more
   * this way" without spending a word on it. */
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View className="min-h-[20px] flex-row items-center justify-between gap-x-2">
      <Text className="font-dm-bold text-micro uppercase text-taupe">{title}</Text>
      {onPress ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={action ?? `See all ${title.toLowerCase()}`}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10 }}
          onPress={onPress}>
          {action ? (
            <Text className="font-dm-medium text-meta text-peach">{action}</Text>
          ) : (
            <MiniChevron />
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A card for a horizontal rail, shaped like the banner above it: thumbnail
 * left, two lines right, one hairline edge around the whole thing.
 *
 * Wide enough for a real place name on one line, narrow enough that the next
 * card is always part-visible — on a two-item row that peek is the only cue
 * the row scrolls, since HRow's fade only paints once content overflows. */
export function RailCard({
  image,
  title,
  meta,
  onPress,
}: {
  image?: string;
  title: string;
  meta?: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={meta ? `${title}. ${meta}` : title}
      activeOpacity={0.78}
      onPress={onPress}
      style={{
        backgroundColor: colors['surface-raised'],
        borderColor: colors.edge,
        borderWidth: StyleSheet.hairlineWidth,
      }}
      className="w-[252px] flex-row items-center gap-x-3 rounded-panel p-2.5">
      <Photo uri={image} radius={11} style={{ width: 52, height: 52 }} />
      <View className="min-w-0 flex-1 pr-1">
        <Text numberOfLines={1} className="font-dm-medium text-body text-ink">{title}</Text>
        {meta ? <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{meta}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
