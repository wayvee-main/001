import * as Linking from 'expo-linking';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Photo } from '@/components/photo';
import { BackButton, ChevronRight, Icon } from '@/components/ui';
import { useRaisedSurface } from '@/lib/shadows';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

/** Edge-to-edge photo hero filling the top of the screen, header actions floating on top. */
export function ImmersiveDetailHero({ image, actions }: { image?: string; actions?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Photo uri={image} radius={0} style={{ height: 211 + insets.top }}>
      <View style={{ top: insets.top + 10 }} className="absolute left-4 right-4 flex-row items-start justify-between">
        <BackButton />
        <View className="flex-row gap-x-2">{actions}</View>
      </View>
    </Photo>
  );
}

/** Content sheet that overlaps the hero bottom, splitting the screen into two sections.
 *
 * `fill` makes the sheet take whatever height is left below the hero. Without
 * it the sheet is exactly as tall as its content, and a short page ends in a
 * band of AppBackdrop's violet wash between the last block and the action bar
 * — the ground is meant to sit behind the page, not to be part of it. The
 * caller must pair it with `flexGrow: 1` on the ScrollView's content
 * container, or there is no leftover height to take. */
export function DetailSheet({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <View
      className={`-mt-5 rounded-t-sheet bg-cream px-5 pt-5 ${fill ? 'pb-6' : ''}`}
      style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: 18, flexGrow: fill ? 1 : 0 }}>
      {children}
    </View>
  );
}

/** Round icon button used in the hero header row (save, call, follow). */
export function DetailIconButton({
  d,
  label,
  onPress,
  active = false,
  activeClassName = 'bg-blush',
  color,
  fill,
}: {
  d: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  activeClassName?: string;
  color?: string;
  fill?: string;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-full border border-sand ${active ? activeClassName : 'bg-shell'}`}>
      <Icon d={d} size={15} color={color ?? colors.peach} fill={fill} />
    </TouchableOpacity>
  );
}

export interface DetailFact {
  label: string;
  value: string;
}

/** One quiet fact list shared by restaurant and venue details. */
export function DetailFactList({ facts }: { facts: DetailFact[] }) {
  return (
    <View>
      {facts.map((fact, index) => (
        <View key={fact.label} className={`flex-row items-baseline gap-x-3 py-2.5 ${index < facts.length - 1 ? 'border-b border-sand' : ''}`}>
          <Text className="w-[84px] shrink-0 font-dm-medium text-meta text-taupe">{fact.label}</Text>
          <Text className="min-w-0 flex-1 font-dm text-meta text-ink">{fact.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Tappable location/contact row used below the hero. */
export function DetailInfoRow({
  iconD,
  label,
  value,
  onPress,
  tone = 'shell',
}: {
  iconD: string;
  label?: string;
  value: string;
  onPress?: () => void;
  tone?: 'shell' | 'blush' | 'sage';
}) {
  const colors = useThemeColors();
  const surface = useRaisedSurface(2);
  const backgroundClass = tone === 'blush' ? 'bg-blush' : tone === 'sage' ? 'bg-sage' : '';
  return (
    <TouchableOpacity
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label ? `${label}: ${value}` : value}
      activeOpacity={0.7}
      onPress={onPress}
      style={tone === 'shell' ? surface : undefined}
      className={`flex-row items-center gap-x-2.5 rounded-card px-3 py-2.5 ${tone === 'shell' ? '' : 'border border-sand'} ${backgroundClass}`}>
      <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-shell">
        <Icon d={iconD} size={15} color={colors.peach} strokeWidth={1.8} />
      </View>
      <View className="min-w-0 flex-1">
        {label ? <Text className="font-dm-bold text-[8.5px] tracking-[0.5px] text-taupe">{label.toUpperCase()}</Text> : null}
        <Text numberOfLines={2} ellipsizeMode="tail" className={`${label ? 'mt-0.5' : ''} font-dm-medium text-[11.5px] leading-[15px] text-ink`}>
          {value}
        </Text>
      </View>
      {onPress ? <ChevronRight color={colors.peach} strokeWidth={1.8} /> : null}
    </TouchableOpacity>
  );
}

/** Consistent official-source handoff used at the end of detail sections. */
export function SourceLink({ url, label = 'View official site' }: { url?: string; label?: string }) {
  const showToast = useScoper((state) => state.showToast);
  const colors = useThemeColors();
  if (!url) return null;
  return (
    <TouchableOpacity
      accessibilityRole="link"
      activeOpacity={0.72}
      onPress={() => Linking.openURL(url).catch(() => showToast('Could not open the official site'))}
      className="h-10 flex-row items-center justify-center gap-x-1.5 rounded-full border border-sand bg-shell px-4">
      <Text className="font-dm-medium text-label text-peach">{label}</Text>
      <ChevronRight color={colors.peach} strokeWidth={1.8} />
    </TouchableOpacity>
  );
}
