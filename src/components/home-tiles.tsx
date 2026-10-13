import { useColorScheme } from 'nativewind';
import { useId } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, Image as SvgImage, Mask, Rect, RadialGradient, Stop } from 'react-native-svg';

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
  /** A photograph from the same pool the count came from. Optional on purpose:
   * Routes counts crawls, which are sequences of places and so have no picture
   * of their own, and a sparse pool may have none either. Without it the tile
   * is exactly the flat tint it has always been. */
  image?: string;
  onPress: () => void;
};

/** The photograph behind a count, faded to nothing through a radial mask
 * anchored off the top-right corner.
 *
 * No hard edge anywhere, and the count sits at top-left where the mask has
 * already fallen to zero — so contrast is a property of the layout, not of
 * whatever the venue happened to put on its website. Of the treatments tried,
 * the two that failed did so here: an oversized glyph and a scrimmed photo
 * both won the tile from the number.
 *
 * Drawn with react-native-svg rather than CSS: `mask-image` is web-only, and
 * this has to hold on iOS and Android too. The ids must be unique per instance
 * because on web every Svg shares one document, and four tiles declaring
 * `url(#fade)` would all resolve to whichever mounted first. */
function TileSpotlight({ uri }: { uri: string }) {
  const { colorScheme } = useColorScheme();
  const unique = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fade = `fade-${unique}`;
  const mask = `mask-${unique}`;
  // The dark tints are near-black, so the same photograph reads far brighter
  // against them than it does on paper.
  const opacity = colorScheme === 'light' ? 0.9 : 0.55;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          {/* `r` only: SVG's radialGradient has no rx/ry, so an elliptical
            * radius is silently dropped on web and the falloff collapses to a
            * default circle in the corner. In objectBoundingBox units the
            * circle is stretched to the tile's own 2:1 proportions anyway,
            * which is the ellipse we wanted. */}
          {/* r is a fraction of the tile, so 0.62 puts the photograph at zero
            * about two-thirds of the way across — past the count and the
            * label, which both start at the left edge. */}
          <RadialGradient id={fade} cx="100%" cy="0%" r="62%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          <Mask id={mask}>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${fade})`} />
          </Mask>
        </Defs>
        <SvgImage
          href={{ uri }}
          x="0"
          y="0"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          opacity={opacity}
          mask={`url(#${mask})`}
        />
      </Svg>
    </View>
  );
}

/** Home's "Around you" grid.
 *
 * Four counts off the four pools the rest of Home is drawn from — kitchens,
 * dated events, the nightlife catalog and the crawls. Each number is the one
 * the section below it would show, so the grid can never disagree with the
 * lists; and each tile opens the pool it counted, because a quantity the guest
 * cannot follow is decoration (CLAUDE.md #3).
 *
 * The glyph is small and paired with the count. An oversized one, and later a
 * photograph scrimmed behind the text, both became the loudest thing on a tile
 * whose point is a number. The photograph is back on different terms: masked
 * to nothing before it reaches the count (see TileSpotlight), and absent
 * entirely wherever the pool has no picture. */
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
                // The spotlight is drawn to the tile's full bounds; without
                // this it would square off the panel's corners.
                overflow: 'hidden',
              }}
              className="min-h-[100px] flex-1 rounded-panel px-3 pb-3 pt-3">
              {tile.image ? <TileSpotlight uri={tile.image} /> : null}
              {/* Glyph and count read as one mark, so they sit together
               * rather than at opposite corners of the tile. */}
              <View className="flex-row items-center justify-between gap-x-2">
                <Glyph name={tile.glyph} size={15} color={colors[tile.ink]} strokeWidth={1.9} />
                <Text
                  style={{ color: colors[tile.ink], fontVariant: ['tabular-nums'] }}
                  className="font-fraunces text-[18px] leading-[22px]">
                  {tile.count}
                </Text>
              </View>
              <Text numberOfLines={1} className="mt-1 font-dm-medium text-body text-ink">{tile.label}</Text>
              <Text numberOfLines={2} className="mt-0.5 font-dm text-fine text-taupe">{tile.hint}</Text>
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
