import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { GradientFill, useAuroraCard } from '@/components/aurora';
import type { DaybreakPeriod } from '@/components/daybreak';
import { Glyph } from '@/components/glyph';
import { PerksPhoto } from '@/components/local-perks';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { VeeMark } from '@/components/vee-mark';
import { useAurora } from '@/lib/aurora';
import { homeCardMetadata, type CardMetadataItem } from '@/lib/card-metadata';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { useThemeColors } from '@/lib/theme';

const briefName = (name: string) => {
  const words = name.trim().split(/\s+/);
  return words.length > 5 ? words.slice(0, 5).join(' ') + '…' : name;
};

/** The approved Quiet Feed is local to Home, below its category divider. */
export function QuietHomePeriods({ value, onChange }: { value: DaybreakPeriod; onChange: (period: DaybreakPeriod) => void }) {
  const colors = useThemeColors();
  return <View testID="daybreak-periods" accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
    {([{ key: 'day', label: 'By day', glyph: 'sun' }, { key: 'evening', label: 'After hours', glyph: 'moon' }] as const).map(item => {
      const selected = value === item.key;
      return <Pressable key={item.key} testID={`daybreak-period-${item.key}`} accessibilityRole="tab" accessibilityState={{ selected }} aria-selected={selected} onPress={() => onChange(item.key)} hitSlop={4}
        style={({ pressed }) => ({ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: pressed ? .7 : 1 })}>
        <Glyph name={item.glyph} size={14} color={selected ? colors.fg : colors['fg-muted']} />
        <View style={{ paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: selected ? colors['fg-accent'] : 'transparent' }}>
          <Text className={selected ? 'font-dm-medium' : 'font-dm'} style={{ fontSize: 13, lineHeight: 18, color: selected ? colors.fg : colors['fg-muted'] }}>{item.label}</Text>
        </View>
      </Pressable>;
    })}
  </View>;
}

export function QuietHomeHeading({ title, onMore }: { title: string; onMore?: () => void }) {
  const colors = useThemeColors(), { width } = useWindowDimensions();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
    <Text accessibilityRole="header" className="font-dm-medium text-ink" style={{ flexShrink: 1, fontSize: width <= 360 ? 18 : 19, lineHeight: 25, letterSpacing: -.45 }}>{title}</Text>
    {onMore ? <Pressable accessibilityRole="button" accessibilityLabel={`More ${title.toLowerCase()}`} onPress={onMore} hitSlop={7}
      style={({ pressed }) => ({ minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? .7 : 1 })}>
      <Text className="font-dm" style={{ fontSize: 12, lineHeight: 18, color: colors['fg-accent'] }}>More</Text><Glyph name="chevron" size={13} color={colors['fg-accent']} />
    </Pressable> : null}
  </View>;
}

function QuietFacts({ items, menuPill = false }: { items: readonly CardMetadataItem[]; menuPill?: boolean }) {
  const colors = useThemeColors(), { width } = useWindowDimensions();
  if (!items.length) return null;
  return <View testID="quiet-home-facts" style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: menuPill ? 9 : 3 }}>
    {items.slice(0, 2).map(item => {
      const pill = menuPill && item.key === 'menu';
      return <View key={item.key} accessible accessibilityLabel={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0,
        ...(pill ? { minHeight: 27, paddingHorizontal: width <= 360 ? 7 : 9, paddingVertical: 4, borderRadius: 14, backgroundColor: colors['accent-tint'] } : {}) }}>
        {item.glyph ? <Glyph name={item.glyph} size={12} color={pill ? colors['fg-accent'] : colors['fg-muted']} /> : null}
        <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm" style={{ flexShrink: 1, fontSize: pill || width <= 360 ? 11 : 12, lineHeight: pill ? 16 : 17, color: pill ? colors['fg-accent'] : colors['fg-muted'] }}>{item.text}</Text>
      </View>;
    })}
  </View>;
}

export function QuietHomeFeature({ entry, catalog, now }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date }) {
  const colors = useThemeColors(), card = useAuroraCard(), router = useRouter(), { width } = useWindowDimensions(), narrow = width <= 360;
  const description = entry.detailContent?.description || entry.description || entry.caption;
  return <Pressable testID="daybreak-poster" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${description}`} onPress={() => router.push(homeGuideHref(entry) as never)}
    style={({ pressed }) => [card, { padding: narrow ? 11 : 13, gap: narrow ? 10 : 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', opacity: pressed ? .8 : 1 }]}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm-medium text-ink" style={{ fontSize: narrow ? 21 : 22, lineHeight: 27, letterSpacing: -.65 }}>{briefName(entry.name)}</Text>
      {description ? <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm" style={{ marginTop: 4, fontSize: narrow ? 11 : 12, lineHeight: narrow ? 17 : 18, color: colors['fg-muted'] }}>{description}</Text> : null}
      <QuietFacts items={homeCardMetadata(entry, now)} menuPill />
    </View>
    <View testID="quiet-home-feature-photo"><PerksPhoto entry={entry} catalog={catalog} width={narrow ? 80 : 92} height={narrow ? 94 : 100} radius={13} retryable={false} /></View>
  </Pressable>;
}

export function QuietHomeGroup({ children, testID = 'home-later-list' }: { children: ReactNode; testID?: string }) {
  const card = useAuroraCard();
  return <View testID={testID} style={[card, { paddingHorizontal: 12, borderRadius: 20 }]}>{children}</View>;
}

export function QuietHomeVenueRow({ entry, catalog, now, divider = false }: { entry: HomeGuideEntry; catalog: HomeGuideCatalog; now: Date; divider?: boolean }) {
  const colors = useThemeColors(), aurora = useAurora(), router = useRouter();
  const category = entry.caption.split(' · ')[0].trim();
  const distance = homeCardMetadata(entry, now).find(item => item.tone === 'distance');
  const facts: CardMetadataItem[] = [
    ...(category ? [{ key: 'category', text: category, glyph: entry.glyph, tone: 'category' as const, label: category }] : []),
    ...(distance ? [distance] : []),
  ];
  return <Pressable testID="daybreak-home-row" accessibilityRole="button" accessibilityLabel={`Explore ${entry.name}. ${facts.map(item => item.label).join('. ')}`} onPress={() => router.push(homeGuideHref(entry) as never)}
    style={({ pressed }) => ({ minHeight: 74, paddingVertical: 10, borderTopWidth: divider ? 1 : 0, borderTopColor: aurora.glassEdge, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? .75 : 1 })}>
    <PerksPhoto entry={entry} catalog={catalog} width={52} height={52} radius={11} retryable={false} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm-medium text-ink" style={{ fontSize: 16, lineHeight: 21, letterSpacing: -.2 }}>{briefName(entry.name)}</Text>
      <QuietFacts items={facts} />
    </View>
    <Glyph name="chevron" size={14} color={colors['fg-muted']} />
  </Pressable>;
}

export function QuietHomeLink({ title, glyph, onPress, testID, accessibilityLabel, divider = false }: { title: string; glyph: string; onPress: () => void; testID: string; accessibilityLabel?: string; divider?: boolean }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, borderTopWidth: divider ? 1 : 0, borderTopColor: aurora.glassEdge, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? .7 : 1 })}>
    <Glyph name={glyph} size={16} color={colors['fg-accent']} />
    <Text numberOfLines={1} ellipsizeMode="tail" className="font-dm text-ink" style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19 }}>{title}</Text>
    <Glyph name="chevron" size={13} color={colors['fg-muted']} />
  </Pressable>;
}

export function QuietHomeOffers() {
  const colors = useThemeColors(), router = useRouter();
  return <Pressable testID="quiet-home-offers" accessibilityRole="button" accessibilityLabel="Local perks. View offers near you" onPress={() => router.push('/offers')}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 13, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 9, opacity: pressed ? .8 : 1 })}>
    <GradientFill radius={13} soft />
    <Glyph name="tag" size={16} color={colors['fg-accent']} />
    <Text className="font-dm text-ink" style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>Local perks · offers near you</Text>
    <Glyph name="chevron" size={13} color={colors['fg-muted']} />
  </Pressable>;
}

export function QuietHomeVee() {
  const colors = useThemeColors(), router = useRouter();
  return <Pressable testID="home-evening-ribbon" accessibilityRole="button" accessibilityLabel="Let Vee connect the dots. Plan your evening" onPress={() => router.push('/create')}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12, borderRadius: 13, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 9, opacity: pressed ? .8 : 1 })}>
    <GradientFill radius={13} soft />
    <VeeMark size={20} />
    <Text className="font-dm text-ink" style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>Let Vee connect the dots.</Text>
    <Glyph name="chevron" size={13} color={colors['fg-muted']} />
  </Pressable>;
}
