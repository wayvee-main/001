import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { CitySearchBar } from '@/components/city-controls';
import { Glyph } from '@/components/glyph';
import { Screen, ScreenScroll } from '@/components/layout';
import { LocalCategoryShelf, LocalPerksBanners, LocalPerksCard, LocalPerksHeader, PerksHeading, PerksRail } from '@/components/local-perks';
import { EmptyState } from '@/components/ui';
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
  const { catalog, displayCity, refreshRegional } = useHomeGuide(), colors = useThemeColors(), router = useRouter(), params = useLocalSearchParams<{ q?: string; mode?: string }>();
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
  const renderCards = (entries: HomeGuideEntry[], feature = false) => <View style={{ gap: 12 }}>{entries.map((entry, index) => <LocalPerksCard key={homeGuideKey(entry.kind, entry.id)} entry={entry} catalog={catalog} format={feature && index === 0 ? 'wide' : 'row'} />)}</View>;
  const onRefresh = async () => { setRefreshing(true); try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateViatorPicksFromBackend(true), refreshRegional()]); } finally { setRefreshing(false); } };
  const seeAll = (category: HomeGuideCategory) => router.push(HOME_LEDGERS[category].href);
  return <Screen><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader title="Discover" />
    <Text accessibilityRole="header" className="font-dm-medium text-ink" style={{ fontSize: 28, lineHeight: 33, letterSpacing: -.7 }}>A little more out there.</Text>
    <CitySearchBar testID="discover-search" city={displayCity} onPress={() => router.push({ pathname: '/search', params: params.q ? { q: params.q } : {} })} />
    <LocalCategoryShelf catalog={catalog} active={(['eat', 'bars', 'routes', 'events'] as string[]).includes(mode) ? mode as HomeGuideCategory : undefined} onSelect={setMode} tone="browse" />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text accessibilityRole="header" className="font-dm-medium text-ink" style={{ fontSize: 20, lineHeight: 26 }}>{search ? `Matches for “${params.q}”` : headings[mode]}</Text><Text className="font-dm text-taupe" style={{ fontSize: 11, lineHeight: 17 }}>{count} {count === 1 ? 'option' : 'options'} to explore</Text></View>
      <Pressable testID="discover-chip-all" accessibilityRole="button" accessibilityLabel="All places" onPress={() => setMode('all')} hitSlop={4} style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text className="font-dm text-taupe" style={{ fontSize: 11, lineHeight: 17 }}>All places</Text><View style={{ transform: [{ rotate: '90deg' }] }}><Glyph name="chevron" size={12} color={colors['fg-muted']} /></View></Pressable>
    </View>
    {search ? search.length ? renderCards(search.slice(0, 30)) : <EmptyState compact title="Nothing here just yet" message="Try another place, artist or kind of evening." /> : <>
      {(mode === 'all' || mode === 'eat' || mode === 'bars' || mode === 'venues') && list.length ? renderCards(list.slice(0, mode === 'all' ? 3 : mode === 'eat' ? 3 : 10), mode === 'all' || mode === 'eat') : null}
      <LocalPerksBanners catalog={catalog} compact />
      {(mode === 'all' && events.length > 0 || mode === 'events') ? <View>{mode === 'all' ? <PerksHeading title="On stage" /> : null}{events[0] ? <LocalPerksCard entry={events[0]} catalog={catalog} format="wide" /> : <EmptyState compact title="No current shows yet" message="Current listings appear here as the calendar updates." />}</View> : null}
      {(mode === 'all' || mode === 'events') && events.length > 1 ? <View><PerksHeading title="More on stage" action="See all" onPress={() => seeAll('events')} /><PerksRail entries={events.slice(1, 7)} catalog={catalog} /></View> : null}
      {(mode === 'all' || mode === 'eat') && tables.length > (mode === 'all' ? 2 : 3) ? <View><PerksHeading title="More good tables" action="See all" onPress={() => seeAll('eat')} /><PerksRail entries={tables.slice(mode === 'all' ? 2 : 3, 9)} catalog={catalog} /></View> : null}
      {mode === 'all' && bars.length > 1 ? <View><PerksHeading title="After dinner" action="See all" onPress={() => seeAll('bars')} /><PerksRail entries={bars.slice(1, 7)} catalog={catalog} /></View> : null}
      {(mode === 'all' || mode === 'routes') && routes.length ? <View><PerksHeading title="A little wandering" action="See all" onPress={() => seeAll('routes')} /><View style={{ gap: 10 }}>{routes.slice(0, 3).map(entry => <LocalPerksCard key={entry.kind + ':' + entry.id} entry={entry} catalog={catalog} />)}</View></View> : null}
      {mode === 'all' && rooms.length ? <View><PerksHeading title="Rooms worth knowing" /><PerksRail entries={rooms.slice(0, 6)} catalog={catalog} /></View> : null}
      {mode === 'all' && !localList.length && !events.length && !routes.length && !rooms.length ? <EmptyState compact title={`More of ${displayCity} is on the way`} message="Local listings appear as the catalog grows." /> : null}
      {mode !== 'all' && !({ eat: tables, bars, routes, events, venues: rooms }[mode]?.length) ? <EmptyState compact title={`More of ${displayCity} is on the way`} message="Local listings appear as the catalog grows." /> : null}
    </>}
  </ScreenScroll></Screen>;
}
