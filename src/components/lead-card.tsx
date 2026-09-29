// The lead pick of a section, given the visual weight the list underneath
// doesn't get — a full-width photo and its own card, so the eye has one clear
// landing point. Shared by both Home sections so the night's top event and the
// top kitchen read as siblings rather than two separately-drifting card
// designs, and now by the nearby carousel, which is a rail of these.
//
// Lifted out of (tabs)/index.tsx verbatim, sizes included: it draws Home's
// event hero today, and changing its type here would move that card as a side
// effect of a different feature.

import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Photo } from '@/components/photo';
import { Icon } from '@/components/ui';
import { ICON_PATHS } from '@/lib/icons';
import { useRaisedSurface } from '@/lib/shadows';
import { useThemeColors } from '@/lib/theme';

/** "Why this is here", when the reason is the guest's own taste profile. Lives
 * beside LeadCard because both Home cards that can carry one use it. */
export function TasteMatch({ tag }: { tag: string }) {
  const colors = useThemeColors();
  return (
    <View className="mt-1 flex-row items-center gap-x-1">
      <Icon d={ICON_PATHS.sparkles} size={9} color={colors.rust} strokeWidth={2} />
      <Text numberOfLines={1} className="font-dm-medium text-[10.5px] text-rust">
        {tag} match
      </Text>
    </View>
  );
}

export function LeadCard({
  image,
  accessibilityLabel,
  onPress,
  badge,
  cornerBadge,
  title,
  titleTrailing,
  meta,
  metaAccessory,
  matchedTag,
}: {
  image?: string;
  accessibilityLabel: string;
  onPress: () => void;
  badge?: ReactNode;
  cornerBadge?: ReactNode;
  title: string;
  titleTrailing?: ReactNode;
  meta: string;
  metaAccessory?: ReactNode;
  matchedTag?: string;
}) {
  const colors = useThemeColors();
  const surface = useRaisedSurface(2);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.72}
      onPress={onPress}
      style={[surface, { backgroundColor: colors['vee-tint'] }]}
      className="overflow-hidden rounded-2xl">
      <View style={{ position: 'relative' }}>
        <Photo uri={image} radius={0} style={{ width: '100%', height: 140 }} />
        {badge ? <View className="absolute left-2.5 top-2.5">{badge}</View> : null}
        {cornerBadge ? <View className="absolute right-2.5 top-2.5">{cornerBadge}</View> : null}
      </View>
      <View className="px-4 py-3">
        <View className="flex-row items-center justify-between gap-x-2">
          <Text numberOfLines={1} className="flex-1 font-dm-bold text-[15px] text-ink">{title}</Text>
          {titleTrailing}
        </View>
        <View className="mt-1 flex-row items-center gap-x-1.5">
          <Text numberOfLines={1} className="shrink font-dm text-meta text-taupe">{meta}</Text>
          {metaAccessory}
        </View>
        {matchedTag ? <TasteMatch tag={matchedTag} /> : null}
      </View>
    </TouchableOpacity>
  );
}
