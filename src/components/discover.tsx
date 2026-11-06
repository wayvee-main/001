import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { AuroraEntryRow, AuroraList, GradientFill, useAuroraCard } from '@/components/aurora';
import { Glyph } from '@/components/glyph';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { Photo } from '@/components/photo';
import { useAppGutter } from '@/components/layout';
import { StubPoster, StubRail, StubStack, StubTicket } from '@/components/stub-cards';
import { useAurora } from '@/lib/aurora';
import { countLabel, type DiscoverCategory, type DiscoverFamily, type DiscoverGuide, type DiscoverSeries } from '@/lib/discover-categories';
import type { DiscoverDeal } from '@/lib/discover-deals';
import { homeGuideHref, type HomeGuideCatalog, type HomeGuideEntry } from '@/lib/home-guide';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import { useLocalPerks } from '@/lib/local-perks-store';
import { useScoper } from '@/lib/store';
import { dateLead, dealLead, weeklyLead } from '@/lib/stub-cards';
import { useThemeColors } from '@/lib/theme';
import { headingStyle } from '@/lib/typography';

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
      <Text accessibilityRole="header" className="text-ink" style={headingStyle(23)}>{title}</Text>
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
      onPress={() => router.push(categoryHref(category.id) as never)} style={({ pressed }) => ({ width: '48.4%', height: 84, borderRadius: 18, overflow: 'hidden', backgroundColor: aurora.photoFallback, opacity: pressed ? .85 : 1 })}>
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

/** A deal as a value ticket: price or happy-hour window in the stub, the venue's own photo when it has one. */
export function DealTicket({ deal, catalog, now, width = 292 }: { deal: DiscoverDeal; catalog: HomeGuideCatalog; now: Date; width?: number | 'full' }) {
  const router = useRouter(), openOffer = useLocalPerks(s => s.openOffer), showToast = useScoper(s => s.showToast);
  const open = () => {
    if (deal.action.type === 'offer') openOffer(deal.action.offer);
    else if (deal.action.type === 'entry') router.push(deal.action.href as never);
    else Linking.openURL(deal.action.url).catch(() => showToast(`Could not open ${deal.who}`));
  };
  const happyHour = deal.badge === 'HH', parts = deal.what.split(' · ');
  const caption = happyHour ? 'Happy hour' : parts[0];
  const accent = happyHour ? deal.what.replace(/happy[ -]?hour/i, '').replace(/\s+/g, ' ').trim() : parts.slice(1).join(' · ');
  const entry = deal.entryKey ? catalog.entries[deal.entryKey] : undefined;
  return <StubTicket testID={`discover-deal-${deal.id}`} lead={dealLead(deal, now)} title={deal.who} tags={deal.tag ? [deal.tag] : undefined} caption={caption} accent={accent || undefined}
    photo={entry ? { candidates: homeIndexPhotos(entry, catalog), glyph: entry.glyph, label: `${entry.name} photo unavailable` } : undefined}
    width={width} onPress={open} accessibilityLabel={`${deal.who}. ${deal.what}${deal.tag ? `. ${deal.tag}` : ''}`} />;
}

export function DiscoverDealsRow({ deals, catalog, now }: { deals: DiscoverDeal[]; catalog: HomeGuideCatalog; now: Date }) {
  return <StubRail testID="discover-deals">{deals.map(deal => <DealTicket key={deal.id} deal={deal} catalog={catalog} now={now} />)}</StubRail>;
}

/** A full-width category poster: photo, scrim, family kicker, name, count and an arrow. */
export function DiscoverCategoryPoster({ category, catalog, count, unit, kicker }: { category: DiscoverCategory; catalog: HomeGuideCatalog; count?: number; unit?: string; kicker: string }) {
  const router = useRouter(), aurora = useAurora(), { width } = useWindowDimensions();
  const total = count ?? category.entries.length, label = unit ? `${total} ${unit}` : countLabel(total, category.unit);
  return <Pressable testID={`discover-poster-${category.id}`} accessibilityRole="button" accessibilityLabel={`${category.title}. ${label}`} onPress={() => router.push(categoryHref(category.id) as never)}
    style={({ pressed }) => ({ height: width <= 360 ? 110 : 120, borderRadius: 20, overflow: 'hidden', backgroundColor: aurora.photoFallback, opacity: pressed ? .88 : 1, boxShadow: aurora.shadow } as ViewStyle)}>
    <Photo candidates={categoryPhotos(category, catalog)} radius={0} stripedPlaceholder={false} retryable={false} fallbackGlyph={category.glyph as never}
      fallbackLabel={`${category.title} photo unavailable`} inkColor="rgba(255, 255, 255, 0.7)" style={[StyleSheet.absoluteFill, { backgroundColor: aurora.photoFallback }]} />
    <LinearGradient pointerEvents="none" colors={[...SCRIM]} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 70, bottom: 13 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Glyph name={category.glyph} size={13} color="rgba(255, 255, 255, 0.9)" strokeWidth={2} />
        <Text className="font-dm-bold" style={{ fontSize: 11, lineHeight: 15, letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.9)' }}>{kicker.toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} className="font-dm-bold" style={{ fontSize: 20, lineHeight: 25, letterSpacing: -.6, color: '#FFFFFF' }}>{category.title}</Text>
      <Text className="font-dm" style={{ fontSize: 12.5, lineHeight: 17, color: 'rgba(255, 255, 255, 0.85)' }}>{label}</Text>
    </View>
    <View pointerEvents="none" style={{ position: 'absolute', right: 14, bottom: 13, width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <GradientFill radius={18} /><View><Glyph name="arrow" size={16} color={aurora.onFill} strokeWidth={2} /></View>
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

/** Dated shows first, then each venue's published weekly series — as date tickets. */
export function DiscoverShows({ events, series, catalog, layout = 'rail' }: { events: HomeGuideEntry[]; series: DiscoverSeries[]; catalog: HomeGuideCatalog; layout?: 'rail' | 'stack' }) {
  const router = useRouter();
  const showtime = (event: HomeGuideEntry) => event.details.find(detail => detail.label === 'Showtime')?.value || event.facts.find(fact => fact.glyph === 'clock')?.value;
  const items = [
    ...events.slice(0, 6).map(event => ({ id: 'event:' + event.id, lead: dateLead(event.startsAt) || { kind: 'thumb' as const }, title: event.name, caption: event.caption, accent: showtime(event), href: homeGuideHref(event),
      photo: { candidates: homeIndexPhotos(event, catalog), glyph: event.glyph, label: `${event.name} photo unavailable` } })),
    ...series.map(item => ({ id: 'series:' + item.id, lead: weeklyLead(item.weekday), title: item.title, caption: [item.venue.name, /21\+/.test(item.venue.caption) ? '21+' : ''].filter(Boolean).join(' · '), accent: item.time, href: item.href, photo: undefined })),
  ];
  if (!items.length) return null;
  const tickets = items.map(item => <StubTicket key={item.id} testID={`discover-show-${item.id}`} lead={item.lead} title={item.title} caption={item.caption} accent={item.accent} photo={item.photo}
    width={layout === 'rail' ? 300 : 'full'} onPress={() => router.push(item.href as never)} accessibilityLabel={[item.title, item.caption, item.accent].filter(Boolean).join('. ')} />);
  return layout === 'rail' ? <StubRail testID="discover-shows">{tickets}</StubRail> : <StubStack testID="discover-shows">{tickets}</StubStack>;
}

/** Venues as square-ish posters on a rail: photo, name, what kind of room, then pills. */
export function DiscoverRooms({ venues, catalog }: { venues: HomeGuideEntry[]; catalog: HomeGuideCatalog }) {
  const router = useRouter();
  if (!venues.length) return null;
  return <StubRail testID="discover-rooms">{venues.slice(0, 8).map(venue => {
    const [kind, detail] = venue.caption.split(' · ');
    const calendar = venue.links.some(link => /calendar|events/i.test(link.url)), place = venue.facts.find(fact => fact.glyph === 'pin')?.value;
    const pills = [calendar ? { text: 'Calendar', glyph: 'ticket' } : place ? { text: place, glyph: 'pin' } : null, detail ? { text: detail.charAt(0).toUpperCase() + detail.slice(1) } : null].filter((pill): pill is { text: string; glyph?: string } => Boolean(pill));
    return <StubPoster key={venue.id} testID={`discover-room-${venue.id}`} title={venue.name} caption={kind} pills={pills}
      photo={{ candidates: homeIndexPhotos(venue, catalog), glyph: venue.glyph, label: `${venue.name} photo unavailable` }}
      onPress={() => router.push(homeGuideHref(venue) as never)} accessibilityLabel={`${venue.name}. ${venue.caption}`} />;
  })}</StubRail>;
}

/** Family chapter frame: a ruled header with the family name and count. */
export function DiscoverChapter({ family, label, children }: { family: DiscoverFamily; label?: string; children: React.ReactNode }) {
  const colors = useThemeColors(), aurora = useAurora();
  return <View testID={`discover-chapter-${family.id}`} style={{ paddingTop: 26, borderTopWidth: 1, borderTopColor: aurora.rule }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, marginHorizontal: 2 }}>
      <Text accessibilityRole="header" className="text-ink" style={headingStyle(29, true)}>{family.title}</Text>
      <Text className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{label || countLabel(family.count, family.unit)}</Text>
    </View>
    {children}
  </View>;
}

export function DiscoverRows({ entries, catalog, now, meta, compact, testID = 'discover-row' }: { entries: HomeGuideEntry[]; catalog: HomeGuideCatalog; now: Date; meta?: Record<string, string>; compact?: boolean; testID?: string }) {
  if (!entries.length) return null;
  return <AuroraList compact={compact} testID={`${testID}-list`}>{entries.map((entry, index) => <AuroraEntryRow key={entry.kind + ':' + entry.id} testID={testID} divider={index > 0} compact={compact} entry={entry} catalog={catalog} now={now} trailing={meta?.[entry.id]} />)}</AuroraList>;
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
