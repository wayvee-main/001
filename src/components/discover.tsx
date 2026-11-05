import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { AuroraEntryRow, AuroraList, GradientFill, useAuroraCard } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { Photo } from '@/components/photo';
import { useAppGutter } from '@/components/layout';
import { useAurora } from '@/lib/aurora';
import { countLabel, type DiscoverCategory, type DiscoverFamily, type DiscoverGuide, type DiscoverSeries } from '@/lib/discover-categories';
import type { DiscoverDeal } from '@/lib/discover-deals';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import { useLocalPerks } from '@/lib/local-perks-store';
import { useScoper } from '@/lib/store';
import { useThemeColors } from '@/lib/theme';

/* Discover's Category posters: shortcuts, a slim deals row, then one chapter per
 * family in the same rhythm (poster, three rows, more in the family). */

export const categoryHref = (id: string) => `/category?id=${encodeURIComponent(id)}` as const;
const categoryPhotos = (category: DiscoverCategory, catalog: HomeGuideCatalog) =>
  category.entries.slice(0, 8).flatMap(entry => homeIndexPhotos(entry, catalog)).slice(0, 6);
const SCRIM = ['rgba(14, 8, 16, 0.05)', 'rgba(14, 8, 16, 0.78)'] as const;

function Bleed({ children, gap }: { children: React.ReactNode; gap: number }) {
  const gutter = useAppGutter();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap }}>{children}</ScrollView>;
}

export function DiscoverSectionHeading({ title, meta, action, onPress }: { title: string; meta?: string; action?: string; onPress?: () => void }) {
  const colors = useThemeColors();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 20, lineHeight: 25, letterSpacing: -.5 }}>{title}</Text>
      {meta ? <Text className="font-dm" style={{ fontSize: 12.5, lineHeight: 17, color: colors['fg-muted'] }}>{meta}</Text> : null}
    </View>
    {action && onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${action}. ${title}`} onPress={onPress} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 1, minHeight: 28 }}>
      <Text className="font-dm-medium" style={{ fontSize: 13.5, lineHeight: 18, color: colors['fg-accent'] }}>{action}</Text><Glyph name="chevron" size={15} color={colors['fg-accent']} />
    </Pressable> : null}
  </View>;
}

/** Up to six shortcut tiles: photo, scrim, name and count. */
export function DiscoverBrowseGrid({ categories, catalog }: { categories: DiscoverCategory[]; catalog: HomeGuideCatalog }) {
  const router = useRouter(), aurora = useAurora();
  return <View testID="discover-browse" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {categories.map(category => <Pressable key={category.id} testID={`discover-browse-${category.id}`} accessibilityRole="button" accessibilityLabel={`${category.title}. ${countLabel(category.entries.length, category.unit)}`}
      onPress={() => router.push(categoryHref(category.id) as never)} style={({ pressed }) => ({ width: '48.4%', height: 92, borderRadius: 18, overflow: 'hidden', backgroundColor: aurora.photoFallback, opacity: pressed ? .85 : 1 })}>
      <Photo candidates={categoryPhotos(category, catalog)} radius={0} stripedPlaceholder={false} retryable={false} fallbackGlyph={category.glyph as never}
        fallbackLabel={`${category.title} photo unavailable`} inkColor="rgba(255, 255, 255, 0.7)" style={[StyleSheet.absoluteFill, { backgroundColor: aurora.photoFallback }]} />
      <LinearGradient pointerEvents="none" colors={[...SCRIM]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <Text numberOfLines={1} className="font-dm-medium" style={{ flexShrink: 1, fontSize: 14.5, lineHeight: 19, color: '#FFFFFF' }}>{category.title}</Text>
        <Text className="font-dm" style={{ fontSize: 12, lineHeight: 16, color: 'rgba(255, 255, 255, 0.85)' }}>{category.entries.length}</Text>
      </View>
    </Pressable>)}
  </View>;
}

/** A slim, swipeable deal: gradient badge, who it's from, the offer in one line. */
export function DiscoverDealCard({ deal, width = 286 }: { deal: DiscoverDeal; width?: number | `${number}%` }) {
  const router = useRouter(), colors = useThemeColors(), aurora = useAurora(), openOffer = useLocalPerks(s => s.openOffer), showToast = useScoper(s => s.showToast);
  const open = () => {
    if (deal.action.type === 'offer') openOffer(deal.action.offer);
    else if (deal.action.type === 'entry') router.push(deal.action.href as never);
    else Linking.openURL(deal.action.url).catch(() => showToast(`Could not open ${deal.who}`));
  };
  return <Pressable testID={`discover-deal-${deal.id}`} accessibilityRole="button" accessibilityLabel={`${deal.who}. ${deal.what}${deal.tag ? `. ${deal.tag}` : ''}`} onPress={open}
    style={({ pressed }) => ({ width, minHeight: 60, borderRadius: 16, borderWidth: 1, borderColor: aurora.glassEdge, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 9, paddingRight: 12, paddingVertical: 8, opacity: pressed ? .8 : 1 })}>
    <GradientFill radius={16} soft />
    <View style={{ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <GradientFill radius={21} />
      {deal.badge ? <Text className="font-dm-bold" style={{ fontSize: 14, lineHeight: 18, letterSpacing: -.3, color: aurora.onFill }}>{deal.badge}</Text> : <View><Glyph name={deal.glyph || 'tag'} size={18} color={aurora.onFill} strokeWidth={2} /></View>}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text numberOfLines={1} className="font-dm-bold text-ink" style={{ flexShrink: 1, fontSize: 14, lineHeight: 19, letterSpacing: -.2 }}>{deal.who}</Text>
        {deal.tag ? <View style={{ borderRadius: 6, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1, backgroundColor: deal.tag === 'Partner' ? colors['surface-raised'] : undefined }}>
          {deal.tag === 'Today' ? <GradientFill radius={6} /> : null}
          <Text className="font-dm-bold" style={{ fontSize: 9.5, lineHeight: 13, letterSpacing: .8, color: deal.tag === 'Today' ? aurora.onFill : colors['fg-muted'] }}>{deal.tag.toUpperCase()}</Text>
        </View> : null}
      </View>
      <Text numberOfLines={1} className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{deal.what}</Text>
    </View>
    <View><Glyph name="chevron" size={14} color={colors['fg-muted']} /></View>
  </Pressable>;
}

export function DiscoverDealsRow({ deals }: { deals: DiscoverDeal[] }) {
  return <Bleed gap={10}>{deals.map(deal => <DiscoverDealCard key={deal.id} deal={deal} />)}</Bleed>;
}

/** A full-width category poster: photo, scrim, family kicker, name, count and an arrow. */
export function DiscoverCategoryPoster({ category, catalog, count, unit, kicker }: { category: DiscoverCategory; catalog: HomeGuideCatalog; count?: number; unit?: string; kicker: string }) {
  const router = useRouter(), aurora = useAurora(), { width } = useWindowDimensions();
  const total = count ?? category.entries.length, label = unit ? `${total} ${unit}` : countLabel(total, category.unit);
  return <Pressable testID={`discover-poster-${category.id}`} accessibilityRole="button" accessibilityLabel={`${category.title}. ${label}`} onPress={() => router.push(categoryHref(category.id) as never)}
    style={({ pressed }) => ({ height: width <= 360 ? 136 : 150, borderRadius: 22, overflow: 'hidden', backgroundColor: aurora.photoFallback, opacity: pressed ? .88 : 1, boxShadow: aurora.shadow } as ViewStyle)}>
    <Photo candidates={categoryPhotos(category, catalog)} radius={0} stripedPlaceholder={false} retryable={false} fallbackGlyph={category.glyph as never}
      fallbackLabel={`${category.title} photo unavailable`} inkColor="rgba(255, 255, 255, 0.7)" style={[StyleSheet.absoluteFill, { backgroundColor: aurora.photoFallback }]} />
    <LinearGradient pointerEvents="none" colors={[...SCRIM]} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 70, bottom: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Glyph name={category.glyph} size={13} color="rgba(255, 255, 255, 0.9)" strokeWidth={2} />
        <Text className="font-dm-bold" style={{ fontSize: 11, lineHeight: 15, letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.9)' }}>{kicker.toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} className="font-dm-bold" style={{ fontSize: 22, lineHeight: 27, letterSpacing: -.6, color: '#FFFFFF' }}>{category.title}</Text>
      <Text className="font-dm" style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255, 255, 255, 0.85)' }}>{label}</Text>
    </View>
    <View pointerEvents="none" style={{ position: 'absolute', right: 14, bottom: 14, width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <GradientFill radius={19} /><View><Glyph name="arrow" size={16} color={aurora.onFill} strokeWidth={2} /></View>
    </View>
  </Pressable>;
}

export function DiscoverMore({ family, categories }: { family: string; categories: DiscoverCategory[] }) {
  const router = useRouter(), colors = useThemeColors(), card = useAuroraCard();
  if (!categories.length) return null;
  return <View style={{ marginTop: 16, gap: 8 }}>
    <Text className="font-dm-bold" style={{ fontSize: 11, lineHeight: 15, letterSpacing: 1.3, color: colors['fg-muted'], marginLeft: 2 }}>{`MORE IN ${family.toUpperCase()}`}</Text>
    <Bleed gap={8}>{categories.map(category => <Pressable key={category.id} testID={`discover-more-${category.id}`} accessibilityRole="button" accessibilityLabel={`${category.title}. ${countLabel(category.entries.length, category.unit)}`}
      onPress={() => router.push(categoryHref(category.id) as never)}
      style={({ pressed }) => ({ ...card, minHeight: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, opacity: pressed ? .75 : 1 })}>
      <View><Glyph name={category.glyph} size={14} color={colors['fg-accent']} strokeWidth={1.8} /></View>
      <Text className="font-dm-medium text-ink" style={{ fontSize: 13.5, lineHeight: 18 }}>{category.title}</Text>
      <Text className="font-dm" style={{ fontSize: 12, lineHeight: 16, color: colors['fg-muted'] }}>{category.entries.length}</Text>
    </Pressable>)}</Bleed>
  </View>;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function DateTile({ top, middle, bottom }: { top: string; middle: string; bottom: string }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <View style={{ width: 50, height: 54, borderRadius: 13, overflow: 'hidden', alignItems: 'center', backgroundColor: colors['surface-sunk'] }}>
    <View style={{ alignSelf: 'stretch', alignItems: 'center', paddingVertical: 2, overflow: 'hidden' }}><GradientFill radius={0} />
      <Text className="font-dm-bold" style={{ fontSize: 10, lineHeight: 13, letterSpacing: 1, color: aurora.onFill }}>{top}</Text></View>
    <Text className="font-dm-bold text-ink" style={{ fontSize: middle.length > 3 ? 15 : 19, lineHeight: 22, marginTop: 2 }}>{middle}</Text>
    <Text className="font-dm-bold" style={{ fontSize: 9, lineHeight: 12, letterSpacing: 1, color: colors['fg-muted'] }}>{bottom}</Text>
  </View>;
}

function ShowRow({ title, meta, tile, href, divider, testID }: { title: string; meta: string; tile: [string, string, string]; href: string; divider: boolean; testID: string }) {
  const router = useRouter(), colors = useThemeColors(), aurora = useAurora();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${title}. ${meta}`} onPress={() => router.push(href as never)}
    style={({ pressed }) => ({ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9, paddingLeft: 12, paddingRight: 16, borderTopWidth: divider ? 1 : 0, borderTopColor: aurora.glassEdge, opacity: pressed ? .72 : 1 })}>
    <DateTile top={tile[0]} middle={tile[1]} bottom={tile[2]} />
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} className="font-dm-medium text-ink" style={{ fontSize: 16, lineHeight: 21, letterSpacing: -.2 }}>{title}</Text>
      <Text numberOfLines={1} className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{meta}</Text>
    </View>
    <Glyph name="chevron" size={16} color={colors['fg-muted']} strokeWidth={1.8} />
  </Pressable>;
}

/** Dated shows first, then each venue's published weekly series. */
export function DiscoverShows({ events, series }: { events: HomeGuideEntry[]; series: DiscoverSeries[] }) {
  const showtime = (event: HomeGuideEntry) => event.details.find(detail => detail.label === 'Showtime')?.value;
  const rows = [
    ...events.slice(0, 3).map(event => { const at = new Date(event.startsAt || ''); const valid = !Number.isNaN(at.getTime());
      return { id: 'event:' + event.id, title: event.name, meta: [event.caption, showtime(event)].filter(Boolean).join(' · '), href: homeGuideHref(event),
        tile: (valid ? [MONTHS[at.getMonth()], String(at.getDate()), DAYS[at.getDay()]] : ['SOON', '·', '']) as [string, string, string] }; }),
    ...series.map(item => ({ id: 'series:' + item.id, title: item.title, meta: [item.venue.name, item.time, /21\+/.test(item.venue.caption) ? '21+' : ''].filter(Boolean).join(' · '),
      href: item.href, tile: ['EVERY', item.weekday.slice(0, 3).toUpperCase(), 'WEEKLY'] as [string, string, string] })),
  ];
  if (!rows.length) return null;
  return <AuroraList testID="discover-shows">{rows.map((row, index) => <ShowRow key={row.id} testID={`discover-show-${row.id}`} divider={index > 0} title={row.title} meta={row.meta} tile={row.tile} href={row.href} />)}</AuroraList>;
}

/** Up to four venues as photo cards with their own facts and calendar. */
export function DiscoverRooms({ venues, catalog }: { venues: HomeGuideEntry[]; catalog: HomeGuideCatalog }) {
  const router = useRouter(), colors = useThemeColors(), card = useAuroraCard(), aurora = useAurora();
  if (!venues.length) return null;
  return <View testID="discover-rooms" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {venues.slice(0, 4).map(venue => {
      const calendar = venue.links.some(link => /calendar|events/i.test(link.url));
      const place = venue.facts.find(fact => fact.glyph === 'pin')?.value;
      return <Pressable key={venue.id} testID={`discover-room-${venue.id}`} accessibilityRole="button" accessibilityLabel={`${venue.name}. ${venue.caption}`} onPress={() => router.push(homeGuideHref(venue) as never)}
        style={({ pressed }) => ({ ...card, width: '48.4%', borderRadius: 18, overflow: 'hidden', opacity: pressed ? .85 : 1 })}>
        <Photo candidates={homeIndexPhotos(venue, catalog)} radius={0} stripedPlaceholder={false} retryable={false} fallbackGlyph={venue.glyph as never}
          fallbackLabel={`${venue.name} photo unavailable`} style={{ width: '100%', height: 96, backgroundColor: aurora.photoFallback }} />
        <View style={{ paddingHorizontal: 11, paddingTop: 9, paddingBottom: 11, gap: 1 }}>
          <Text numberOfLines={1} className="font-dm-medium text-ink" style={{ fontSize: 14, lineHeight: 19 }}>{venue.name}</Text>
          <Text numberOfLines={1} className="font-dm" style={{ fontSize: 12, lineHeight: 16, color: colors['fg-muted'] }}>{venue.caption.split(' · ')[0]}</Text>
          {calendar || place ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
            <Glyph name={calendar ? 'calendar' : 'pin'} size={12} color={colors['fg-accent']} strokeWidth={2} />
            <Text numberOfLines={1} className="font-dm-medium" style={{ flexShrink: 1, fontSize: 11.5, lineHeight: 15, color: colors['fg-accent'] }}>{[calendar ? 'Calendar' : '', place].filter(Boolean).join(' · ')}</Text>
          </View> : null}
        </View>
      </Pressable>;
    })}
  </View>;
}

/** Family chapter frame: a ruled header with the family name and count. */
export function DiscoverChapter({ family, label, children }: { family: DiscoverFamily; label?: string; children: React.ReactNode }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <View testID={`discover-chapter-${family.id}`} style={{ paddingTop: 26, borderTopWidth: 1, borderTopColor: aurora.rule }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, marginHorizontal: 2 }}>
      <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 26, lineHeight: 31, letterSpacing: -.8 }}>{family.title}</Text>
      <Text className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{label || countLabel(family.count, family.unit)}</Text>
    </View>
    {children}
  </View>;
}

export function DiscoverRows({ entries, catalog, now, meta, testID = 'discover-row' }: { entries: HomeGuideEntry[]; catalog: HomeGuideCatalog; now: Date; meta?: Record<string, string>; testID?: string }) {
  if (!entries.length) return null;
  return <AuroraList testID={`${testID}-list`}>{entries.map((entry, index) => <AuroraEntryRow key={entry.kind + ':' + entry.id} testID={testID} divider={index > 0} entry={entry} catalog={catalog} now={now} trailing={meta?.[entry.id]} />)}</AuroraList>;
}

/** Discover's lead category per family; falls back to the family's largest. */
const LEAD: Record<string, string> = { eat: 'pizza', 'go-out': 'shows', drink: 'cocktail-bars', wander: 'lakes-trails' };
export function leadCategory(family: DiscoverFamily): DiscoverCategory | undefined {
  return family.categories.find(category => category.id === LEAD[family.id] && category.entries.length) || [...family.categories].sort((a, b) => b.entries.length - a.entries.length)[0];
}

export function useDiscoverShortcuts(guide: DiscoverGuide): DiscoverCategory[] {
  const order = ['open-late', 'happy-hours', 'budget', 'shows', 'cocktail-bars', 'lakes-trails'];
  const picked = order.map(id => guide.byId[id]).filter((category): category is DiscoverCategory => Boolean(category?.entries.length));
  return picked.length % 2 ? picked.slice(0, -1) : picked;
}
