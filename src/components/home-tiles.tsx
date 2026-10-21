import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { PHOTO_NOTE } from '@/components/field-notes';
import { useAppGutter } from '@/components/layout';
import { MiniChevron } from '@/components/ui';
import { Photo } from '@/components/photo';
import { useElevation, useRaisedSurface } from '@/lib/shadows';
import { useThemeColors, type ThemeColors } from '@/lib/theme';

export type CountTile = {
  key: string;
  /** Already formatted: some counts are exact, others are a catalog size. */
  count: string;
  label: string;
  tint: keyof ThemeColors;
  ink: keyof ThemeColors;
  glyph: GlyphName;
  onPress: () => void;
};

/** Quiet outline illustrations in the existing tile frame. The heading, count,
 * chevron, grid geometry and elevation retain their existing treatment. */
function GalleryTile({ tile, width }: { tile: CountTile; width: number }) {
  const colors = useThemeColors();
  const elevation = useElevation(3);
  const photoHeight = Math.round(width * PHOTO_NOTE.photoHeight / PHOTO_NOTE.photoWidth);
  const scrim = colors['selected-surface'];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Explore ${tile.count} ${tile.label}`}
      activeOpacity={0.78}
      onPress={tile.onPress}
      testID={`home-count-tile-${tile.key}`}
      style={{ width, flexShrink: 0 }}>
      <View testID={`home-tile-mount-${tile.key}`}
        style={[elevation, { height: photoHeight, borderRadius: PHOTO_NOTE.radius, overflow: 'hidden', backgroundColor: scrim }]}>
        <View testID={`home-tile-illustration-${tile.key}`} accessible={false} pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 5, bottom: 29, alignItems: 'center', justifyContent: 'center', opacity: 0.22 }}>
          <Glyph name={tile.glyph} size={Math.min(64, Math.round(photoHeight * .62))} color={colors['selected-glyph']} strokeWidth={1.2} />
        </View>
        <LinearGradient
          testID={`home-tile-scrim-${tile.key}`}
          pointerEvents="none"
          accessible={false}
          colors={[`${scrim}00`, `${scrim}F9`]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.scrim}
        />
        <View testID={`home-tile-heading-${tile.key}`}
          style={{
            position: 'absolute', left: 11, right: 10, bottom: 9,
            flexDirection: 'row', alignItems: 'center', gap: 8,
          }}>
          <View className="min-w-0 flex-1 flex-row items-baseline" style={{ gap: 6 }}>
            <Text testID={`home-tile-title-${tile.key}`} numberOfLines={1}
              className="shrink font-fraunces"
              style={{ color: colors['on-selected'], fontSize: 17, lineHeight: 19.55, letterSpacing: -0.2 }}>
              {tile.label}
            </Text>
            <Text testID={`home-tile-count-${tile.key}`} numberOfLines={1}
              className="shrink-0 font-dm-medium"
              style={{ color: colors['selected-glyph'], fontSize: 13, lineHeight: 19.55 }}>
              {tile.count}
            </Text>
          </View>
          <View testID={`home-tile-chevron-${tile.key}`} accessible={false} pointerEvents="none"
            style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Glyph name="chevron" size={16} color={colors['on-selected']} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Home's "Around you" grid.
 *
 * Four counts off the four pools the rest of Home is drawn from — kitchens,
 * dated events, the nightlife catalog and the crawls. Each number is the one
 * the section below it would show, so the grid can never disagree with the
 * lists; and each tile opens the pool it counted, because a quantity the guest
 * cannot follow is decoration (CLAUDE.md #3).
 */
export function AroundYou({ tiles }: { tiles: CountTile[] }) {
  const { width } = useWindowDimensions();
  const gutter = useAppGutter();
  const gap = 16;
  const availableWidth = Math.min(width, 720) - gutter * 2;
  const cardWidth = (availableWidth - gap) / 2;
  const rows: CountTile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <View testID="around-you-grid" style={{width:cardWidth*2+gap,alignSelf:'center',gap}}>
      {rows.map(row => (
        <View key={row.map(tile => tile.key).join('-')} style={{flexDirection:'row',gap}}>
          {row.map(tile => (
            <GalleryTile key={tile.key} tile={tile} width={cardWidth} />
          ))}
          {row.length===1 ? <View style={{width:cardWidth}} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
});

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
  const surface = useRaisedSurface(1);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={meta ? `${title}. ${meta}` : title}
      activeOpacity={0.78}
      onPress={onPress}
      style={surface}
      className="w-[252px] flex-row items-center gap-x-3 rounded-panel p-2.5">
      <Photo uri={image} radius={11} style={{ width: 52, height: 52 }} />
      <View className="min-w-0 flex-1 pr-1">
        <Text numberOfLines={1} className="font-dm-medium text-body text-ink">{title}</Text>
        {meta ? <Text numberOfLines={1} className="mt-0.5 font-dm text-meta text-taupe">{meta}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}
