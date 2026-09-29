import * as Linking from 'expo-linking';
import { Text, TouchableOpacity, View } from 'react-native';

import { Photo } from '@/components/photo';
import { PlanChip } from '@/components/plan-actions';
import { Badge, Icon } from '@/components/ui';
import { useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { viatorHighlightChip, viatorPriceLabel, type ViatorPick } from '@/lib/viator';

const TICKET_ICON = 'M15 5l0 2 M15 11l0 2 M15 17l0 2 M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2';

export const POSTER_WIDTH = 173;

/** Home's "Picks for your stay" poster — also reused as-is anywhere else
 * Viator picks are shown (e.g. Discover's "Experiences near you"), so both
 * carousels stay pixel-identical instead of drifting apart over time. */
export function ViatorPickCard({ pick, onPress }: { pick: ViatorPick; onPress: () => void }) {
  const surface = useRaisedSurface(2);
  const price = viatorPriceLabel(pick);
  const highlight = viatorHighlightChip(pick);
  const showToast = useScoper((s) => s.showToast);
  const restLine = [pick.durationLabel, pick.rating ? `${pick.rating.toFixed(1)}★` : null].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${pick.title}`}
      activeOpacity={0.72}
      onPress={onPress}
      style={[surface, { width: POSTER_WIDTH }]}
      className="overflow-hidden rounded-card">
      <View style={{ position: 'relative' }}>
        <Photo uri={pick.image} radius={0} style={{ width: POSTER_WIDTH, height: 85 }} />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Book ${pick.title} on Viator`}
          activeOpacity={0.75}
          onPress={() => Linking.openURL(pick.bookingUrl).catch(() => showToast('Could not open Viator'))}
          className="absolute right-1.5 top-1.5 h-7 w-7 items-center justify-center rounded-full bg-ember">
          <Icon d={TICKET_ICON} size={13} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <View className="px-3 py-2.5">
        {highlight ? <Badge label={highlight} /> : null}
        <Text numberOfLines={2} className={`font-dm-bold text-[13px] leading-[16px] text-ink ${highlight ? 'mt-1' : ''}`}>{pick.title}</Text>
        {price || restLine ? (
          <Text numberOfLines={1} className="mt-1 font-dm text-[10.5px] text-taupe">
            {price ? <Text className="font-dm-bold text-pine">{price}</Text> : null}
            {price && restLine ? ' · ' : ''}
            {restLine}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** Same poster shape as ViatorPickCard (width, photo size, rounded border,
 * text block) for non-Viator carousels — venues, walkable routes — that have
 * no booking action, just a detail page to open. */
export function PosterCard({
  image,
  eyebrow,
  title,
  meta,
  onPress,
  onPlan,
}: {
  image?: string;
  eyebrow: string;
  title: string;
  meta?: string;
  onPress: () => void;
  onPlan?: () => void;
}) {
  const surface = useRaisedSurface(2);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      activeOpacity={0.72}
      onPress={onPress}
      style={[surface, { width: POSTER_WIDTH }]}
      className="overflow-hidden rounded-card">
      <Photo uri={image} radius={0} style={{ width: POSTER_WIDTH, height: 85 }} />
      <View className="px-3 py-2.5">
        <Text numberOfLines={1} className="font-dm-bold text-[8.5px] tracking-[0.6px] text-peach">{eyebrow}</Text>
        <Text numberOfLines={2} className="mt-1 font-dm-bold text-[13px] leading-[16px] text-ink">{title}</Text>
        {meta ? <Text numberOfLines={1} className="mt-1 font-dm text-[10.5px] text-taupe">{meta}</Text> : null}
        {onPlan ? (
          <View className="mt-2 items-start">
            <PlanChip onPress={onPlan} />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
