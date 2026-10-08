import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  /** A real photo from the pool this tile counts — the lead event's art, a
   * dish, a bar. Absent is fine: the tile falls back to its flat tint. */
  image?: string;
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
 * No glyph. An icon here would say what the label already says, and at tile
 * size it competes with the count, which is the only thing on the tile worth
 * reading first. */
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
              className="min-h-[86px] flex-1 overflow-hidden rounded-panel px-3.5 pb-3.5 pt-3">
              {/* The photo sits on the right and the tile's own tint is drawn
               * back over it, opaque under the text and clearing by the right
               * edge. The count stays on flat colour — a number read against
               * photography is a number read twice. */}
              {tile.image ? (
                <>
                  <Photo
                    uri={tile.image}
                    radius={0}
                    stripedPlaceholder={false}
                    // Tinted behind the photo: a URL that fails to load
                    // leaves the tile's own colour, not a hole in it.
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '64%',
                      backgroundColor: colors[tile.tint],
                    }}
                  />
                  <LinearGradient
                    colors={[colors[tile.tint], colors[tile.tint], 'transparent']}
                    locations={[0, 0.36, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </>
              ) : null}
              <Text
                style={{ color: colors[tile.ink], fontVariant: ['tabular-nums'] }}
                className="font-fraunces text-[23px] leading-[27px]">
                {tile.count}
              </Text>
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
export function SubLabel({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View className="min-h-[18px] flex-row items-baseline justify-between gap-x-2">
      <Text className="font-dm-bold text-micro uppercase text-taupe">{title}</Text>
      {action && onPress ? (
        <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10 }} onPress={onPress}>
          <Text className="font-dm-medium text-meta text-peach">{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A card for a horizontal rail: picture on top, two lines under it.
 *
 * Narrow enough that the next card is always part-visible, which is what tells
 * you the row scrolls — the edge fade HRow draws only appears once the content
 * actually overflows, so on a short row the card peeking out is the only cue. */
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
        borderColor: colors['edge-soft'],
        borderWidth: StyleSheet.hairlineWidth,
      }}
      className="w-[158px] overflow-hidden rounded-panel">
      <Photo uri={image} radius={0} style={{ width: '100%', height: 94 }} />
      <View className="px-3 pb-3 pt-2.5">
        <Text numberOfLines={2} className="font-dm-medium text-body leading-[18px] text-ink">{title}</Text>
        {meta ? <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{meta}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
