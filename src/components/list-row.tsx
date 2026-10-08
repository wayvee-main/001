import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Photo } from '@/components/photo';
import { ChevronRight } from '@/components/ui';
import { useElevation } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

/** Icon/photo + title + optional pill + meta + chevron — the shape every
 * "row of things" screen reimplemented slightly differently — today the food
 * hub's FoodHubRow. One definition, one visual language for a tappable row.
 *
 * Carries its own horizontal padding: every caller drops these into a
 * rounded-card with overflow-hidden, and without it the thumbnail sat flush on
 * the card edge and had its corners sliced off by the card's own radius. */
export function ListRow({
  image,
  title,
  badge,
  badgeTone = 'sage',
  meta,
  tasteTag,
  divider = true,
  trailing,
  onPress,
}: {
  image?: string;
  title: string;
  badge?: string;
  badgeTone?: 'sage' | 'accent';
  meta?: string;
  /** The guest's own taste tag this row matched on, when it matched one. Same
   * "why you're seeing this" line Home puts under a matched pick. */
  tasteTag?: string;
  divider?: boolean;
  /** Replaces the chevron when the row ends in a fact rather than an arrow —
   * a closing time, a start time. A row carries one or the other, never both:
   * two trailing marks read as two different affordances. */
  trailing?: ReactNode;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const elevation = useElevation(1);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View ${title}`}
      activeOpacity={0.72}
      onPress={onPress}
      className={`flex-row items-center gap-x-3 px-3.5 py-3 ${divider ? 'border-b border-sand' : ''}`}>
      <Photo uri={image} radius={14} style={{ width: 60, height: 60, ...elevation }} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm-bold text-[14px] text-ink">
          {title}
        </Text>
        {badge ? (
          <View className={`mt-1 self-start rounded-full px-2 py-[2px] ${badgeTone === 'accent' ? 'bg-blush' : 'bg-sage'}`}>
            <Text numberOfLines={1} ellipsizeMode="tail" className={`font-dm-medium text-[10px] ${badgeTone === 'accent' ? 'text-peach' : 'text-pine'}`}>
              {badge}
            </Text>
          </View>
        ) : null}
        {meta ? (
          <Text numberOfLines={1} ellipsizeMode="tail" className="mt-1 font-dm text-meta text-taupe">
            {meta}
          </Text>
        ) : null}
        {tasteTag ? (
          <View className="mt-1 flex-row items-center gap-x-1">
            <Glyph name="spark" size={9} color={colors.rust} strokeWidth={2} />
            <Text numberOfLines={1} className="font-dm-medium text-[10.5px] text-rust">
              {tasteTag} match
            </Text>
          </View>
        ) : null}
      </View>
      {trailing ? (
        <View className="shrink-0">{trailing}</View>
      ) : (
        <View className="h-7 w-7 shrink-0 items-center justify-center">
          <ChevronRight color={colors.peach} strokeWidth={1.8} />
        </View>
      )}
    </TouchableOpacity>
  );
}
