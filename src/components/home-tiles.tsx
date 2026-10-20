import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Glyph, type GlyphName } from '@/components/glyph';
import { NoteCard, NoteFact, PHOTO_NOTE } from '@/components/field-notes';
import { useAppGutter } from '@/components/layout';
import { MiniChevron } from '@/components/ui';
import { Photo } from '@/components/photo';
import { useRaisedSurface } from '@/lib/shadows';
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
  /** A sourced secondary fact, displayed at the right of the inventory row. */
  metadata?: { glyph: GlyphName; value: string; label: string };
  /** Bundled, full-frame category photo, or a photo from the active catalog. */
  image?: string | number;
  imageLabel?: string;
  onPress: () => void;
};

/** More on stage photo proportions, scaled to fill each Home column. */
function TileWindow({ tile, width }: { tile: CountTile; width: number }) {
  const colors = useThemeColors();
  const [failedImage, setFailedImage] = useState<string | number>();
  const showImage = tile.image !== undefined && failedImage !== tile.image;
  const paper = colors['home-tile'];

  return (
    <View testID={`home-tile-window-${tile.key}`} style={[styles.window,{width,height:width*PHOTO_NOTE.photoHeight/PHOTO_NOTE.photoWidth}]}>
      {showImage ? (
        <View testID={`home-tile-photo-frame-${tile.key}`}
          style={[styles.photoFrame,{borderWidth:1,borderColor:colors['edge-faint']}]}>
          <Image
            testID={`home-tile-image-${tile.key}`}
            source={tile.image}
            accessibilityLabel={tile.imageLabel}
            accessible={false}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            cachePolicy="memory-disk"
            transition={120}
            recyclingKey={String(tile.image)}
            onError={() => setFailedImage(tile.image)}
          />
          <LinearGradient
            testID={`home-tile-fade-${tile.key}`}
            pointerEvents="none"
            accessible={false}
            colors={[`${paper}00`, `${paper}0F`]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.fade}
          />
        </View>
      ) : (
        <View testID={`home-tile-fallback-${tile.key}`} style={styles.fallback}>
          <Glyph name={tile.glyph} size={25} color={colors['home-tile-glyph']} strokeWidth={1.7} />
        </View>
      )}
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
            <NoteCard
              key={tile.key}
              testID={`home-count-tile-${tile.key}`}
              titleTestID={`home-tile-title-${tile.key}`}
              accessibilityName={`${tile.count} ${tile.label}, ${tile.hint}${tile.metadata ? `. ${tile.metadata.label}` : ''}`}
              name={tile.label}
              facts={<>
                <View testID={`home-tile-count-${tile.key}`} style={{flexShrink:0}}>
                  <NoteFact glyph={tile.glyph} value={tile.count} label={`${tile.count} ${tile.label}`} compact />
                </View>
                {tile.metadata ? <View testID={`home-tile-metadata-${tile.key}`} style={{marginLeft:'auto',minWidth:0,flexShrink:1}}>
                  <NoteFact glyph={tile.metadata.glyph} value={tile.metadata.value} label={tile.metadata.label} compact flexible />
                </View> : null}
              </>}
              photo={<TileWindow tile={tile} width={cardWidth-PHOTO_NOTE.padding*2} />}
              cardWidth={cardWidth}
              tone="neutral"
              strip
              elevated
              compact
              divider={false}
              onPress={tile.onPress}
            />
          ))}
          {row.length===1 ? <View style={{width:cardWidth}} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { borderRadius: PHOTO_NOTE.photoRadius, overflow: 'hidden', marginBottom: PHOTO_NOTE.photoGap },
  photoFrame: { width: '100%', height: '100%', borderRadius: PHOTO_NOTE.photoRadius, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 18 },
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
