import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { AuroraEntryRow, AuroraList, AuroraPoster, GradientText, SectionRule, useGlass } from '@/components/aurora';
import { CitySearchBar } from '@/components/city-controls';
import { Glyph } from '@/components/glyph';
import { Screen, ScreenScroll } from '@/components/layout';
import { LocalCategoryShelf, LocalPerksBanners, LocalPerksHeader, PerksHeading } from '@/components/local-perks';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { homeGuideKey, searchHomeGuide, type HomeGuideCategory, type HomeGuideEntry } from '@/lib/home-guide';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { perksEntries, perksFeaturedEntries } from '@/lib/local-perks';
import { hydratePlacesFromBackend } from '@/lib/places';
import { useHomeGuide } from '@/lib/use-home-guide';
import { useThemeColors } from '@/lib/theme';
import { hydrateViatorPicksFromBackend } from '@/lib/viator';

const modes = [{ key: 'all', label: 'For you', glyph: 'spark' }, { key: 'eat', label: 'Eat', glyph: 'food' }, { key: 'bars', label: 'Bars', glyph: 'drink' }, { key: 'events', label: 'Events', glyph: 'ticket' }, { key: 'routes', label: 'Routes', glyph: 'route' }, { key: 'venues', label: 'Venues', glyph: 'landmark' }] as const;
type Mode = typeof modes[number]['key'];
const normalize = (value?: string): Mode => ({ Food: 'eat', Nightlife: 'bars', Events: 'events', Routes: 'routes', Venues: 'venues' } as Record<string, Mode>)[value || ''] || modes.find(mode => mode.key === value)?.key || 'all';

export default function DiscoverScreen() {
  const { catalog, displayCity, refreshRegional } = useHomeGuide(), colors = useThemeColors(), glass = useGlass(), now = useNow(), router = useRouter(), params = useLocalSearchParams<{ q?: string; mode?: string }>();
  const [mode, setMode] = useState<Mode>(normalize(params.mode)), [refreshing, setRefreshing] = useState(false), [seed, setSeed] = useState(params.mode);
  if (seed !== params.mode) { setSeed(params.mode); setMode(normalize(params.mode)); }
  const tables = perksFeaturedEntries(catalog, 'eat'), bars = perksFeaturedEntries(catalog, 'bars'), events = perksEntries(catalog, 'events'), routes = perksEntries(catalog, 'routes');
  const rooms = Object.values(catalog.entries).filter(entry => entry.kind === 'venue' || entry.kind === 'place' && /venue|theatre|cinema|museum|gallery/.test(entry.category || ''));
  const search = params.q?.trim() ? searchHomeGuide(catalog, params.q) : null;
  const localList = [...new Map([...tables.slice(0, 2), ...bars.slice(0, 1), ...tables, ...bars].map(entry => [homeGuideKey(entry.kind, entry.id), entry])).values()].slice(0, 3);
  const pools = { all: localList, eat: tables, bars, events, routes, venues: rooms };
  const list = search || pools[mode];
  const allCount = new Set([...tables, ...bars, ...events, ...routes, ...rooms].map(entry => homeGuideKey(entry.kind, entry.id))).size;
  const count = search ? search.length : mode === 'all' ? allCount : list.length;
  const headings: Record<Mode, string> = { all: 'The local list', eat: 'A good table', bars: 'After dinner', events: 'On stage', routes: 'A little wandering', venues: 'Rooms worth knowing' };
    const renderCards = (entries: HomeGuideEntry[], feature = false) => {
    const [first, ...rest] = entries, lead = feature && first ? first : undefined, rows = lead ? rest : entries;
    return <View style={{ gap: 12 }}>
      {lead ? <AuroraPoster testID="discover-feature" entry={lead} catalog={catalog} now={now} chip={{ label: 'A good table', glyph: 'food' }} /> : null}
      {rows.length ? <AuroraList>{rows.map((entry, index) => <AuroraEntryRow key={homeGuideKey(entry.kind, entry.id)} testID="discover-row" divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList> : null}
    </View>;
  };
  const calmList = (entries: HomeGuideEntry[], testID: string) => <AuroraList testID={`${testID}-list`}>{entries.map((entry, index) =>
    <AuroraEntryRow key={homeGuideKey(entry.kind, entry.id)} testID={testID} divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList>;
  const onRefresh = async () => { setRefreshing(true); try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateViatorPicksFromBackend(true), refreshRegional()]); } finally { setRefreshing(false); } };
  const seeAll = (category: HomeGuideCategory) => router.push(HOME_LEDGERS[category].href);
  const emptyCity = <EmptyState compact title={`More of ${displayCity} is on the way`} message="Local listings appear as the catalog grows." />;
  // Top-level sections in reading order; a hairline separates each from the next.
  const sections: ReactNode[] = search ? [
    <View key="matches">{search.length ? renderCards(search.slice(0, 30)) : <EmptyState compact title="Nothing here just yet" message="Try another place, artist or kind of evening." />}</View>,
  ] : [
    <View key="list" style={{ gap: 12 }}>
      {(mode === 'all' || mode === 'eat' || mode === 'bars' || mode === 'venues') && list.length ? renderCards(list.slice(0, mode === 'all' ? 3 : mode === 'eat' ? 3 : 10), mode === 'all' || mode === 'eat') : null}
      <LocalPerksBanners catalog={catalog} compact />
    </View>,
    (mode === 'all' && events.length > 0 || mode === 'events') ? <View key="stage">{mode === 'all' ? <PerksHeading title="On stage" /> : null}{events[0] ? <AuroraPoster testID="discover-stage" entry={events[0]} catalog={catalog} now={now} chip={{ label: 'On stage', glyph: 'ticket' }} /> : <EmptyState compact title="No current shows yet" message="Current listings appear here as the calendar updates." />}</View> : null,
    (mode === 'all' || mode === 'events') && events.length > 1 ? <View key="more-stage"><PerksHeading title="More on stage" action="See all" onPress={() => seeAll('events')} />{calmList(events.slice(1, 4), 'discover-stage-row')}</View> : null,
    (mode === 'all' || mode === 'eat') && tables.length > (mode === 'all' ? 2 : 3) ? <View key="tables"><PerksHeading title="More good tables" action="See all" onPress={() => seeAll('eat')} />{calmList(tables.slice(mode === 'all' ? 2 : 3, mode === 'all' ? 5 : 9), 'discover-table-row')}</View> : null,
    mode === 'all' && bars.length > 1 ? <View key="after"><PerksHeading title="After dinner" action="See all" onPress={() => seeAll('bars')} />{calmList(bars.slice(1, 4), 'discover-bar-row')}</View> : null,
    (mode === 'all' || mode === 'routes') && routes.length ? <View key="routes"><PerksHeading title="A little wandering" action="See all" onPress={() => seeAll('routes')} /><AuroraList>{routes.slice(0, 3).map((entry, index) => <AuroraEntryRow key={entry.kind + ':' + entry.id} testID="discover-route" divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList></View> : null,
    mode === 'all' && rooms.length ? <View key="rooms"><PerksHeading title="Rooms worth knowing" />{calmList(rooms.slice(0, 3), 'discover-room-row')}</View> : null,
    mode === 'all' && !localList.length && !events.length && !routes.length && !rooms.length ? <View key="empty-all">{emptyCity}</View> : null,
    mode !== 'all' && !({ eat: tables, bars, routes, events, venues: rooms }[mode]?.length) ? <View key="empty-mode">{emptyCity}</View> : null,
  ].filter(Boolean);
  return <Screen aurora><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader title="Discover" />
    <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 30, lineHeight: 35, letterSpacing: -1 }}>A little more <GradientText text="out there." /></Text>
    <CitySearchBar variant="aurora" testID="discover-search" city={displayCity} onPress={() => router.push({ pathname: '/search', params: params.q ? { q: params.q } : {} })} />
    <LocalCategoryShelf catalog={catalog} active={(['eat', 'bars', 'routes', 'events'] as string[]).includes(mode) ? mode as HomeGuideCategory : undefined} onSelect={setMode} tone="browse" />
    <SectionRule />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: -4 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text accessibilityRole="header" className="font-dm-medium text-ink" style={{ fontSize: 20, lineHeight: 25, letterSpacing: -.4 }}>{search ? `Matches for “${params.q}”` : headings[mode]}</Text><Text className="font-dm" style={{ fontSize: 13, lineHeight: 18, color: colors['fg-muted'] }}>{count} {count === 1 ? 'option' : 'options'} to explore</Text></View>
      <Pressable testID="discover-chip-all" accessibilityRole="button" accessibilityLabel="All places" onPress={() => setMode('all')} hitSlop={4}
        style={({ pressed }) => ({ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 14, paddingRight: 10, borderRadius: 18, opacity: pressed ? .72 : 1, ...glass })}><Text className="font-dm" style={{ fontSize: 14, lineHeight: 19, color: colors['fg-muted'] }}>All places</Text><View style={{ transform: [{ rotate: '90deg' }] }}><Glyph name="chevron" size={14} color={colors['fg-muted']} /></View></Pressable>
    </View>
    {sections.map((section, index) => index ? [<SectionRule key={`rule-${index}`} />, section] : section)}
  </ScreenScroll></Screen>;
}
