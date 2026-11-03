import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CityChip, CitySearchBar } from '@/components/city-controls';
import { HRow, Screen, ScreenScroll } from '@/components/layout';
import { LocalPerksBanners, LocalPerksCard, LocalPerksHeader, PerksHeading, PerksRail } from '@/components/local-perks';
import { EmptyState } from '@/components/ui';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { searchHomeGuide, type HomeGuideCategory } from '@/lib/home-guide';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { perksEntries } from '@/lib/local-perks';
import { hydratePlacesFromBackend } from '@/lib/places';
import { useHomeGuide } from '@/lib/use-home-guide';
import { hydrateViatorPicksFromBackend } from '@/lib/viator';

const modes = [{ key: 'all', label: 'For you', glyph: 'spark' }, { key: 'eat', label: 'Eat', glyph: 'food' }, { key: 'bars', label: 'Bars', glyph: 'drink' }, { key: 'events', label: 'Events', glyph: 'ticket' }, { key: 'routes', label: 'Routes', glyph: 'route' }, { key: 'venues', label: 'Venues', glyph: 'landmark' }] as const;
type Mode = typeof modes[number]['key'];
const normalize = (value?: string): Mode => ({ Food: 'eat', Nightlife: 'bars', Events: 'events', Routes: 'routes', Venues: 'venues' } as Record<string, Mode>)[value || ''] || modes.find(mode => mode.key === value)?.key || 'all';

export default function DiscoverScreen() {
  const { catalog, displayCity, refreshRegional } = useHomeGuide(), router = useRouter(), params = useLocalSearchParams<{ q?: string; mode?: string }>();
  const [mode, setMode] = useState<Mode>(normalize(params.mode)), [refreshing, setRefreshing] = useState(false), [seed, setSeed] = useState(params.mode);
  if (seed !== params.mode) { setSeed(params.mode); setMode(normalize(params.mode)); }
  const tables = perksEntries(catalog, 'eat'), bars = perksEntries(catalog, 'bars'), events = perksEntries(catalog, 'events'), routes = perksEntries(catalog, 'routes');
  const rooms = Object.values(catalog.entries).filter(entry => entry.kind === 'venue' || entry.kind === 'place' && /venue|theatre|cinema|museum|gallery/.test(entry.category || ''));
  const search = params.q?.trim() ? searchHomeGuide(catalog, params.q) : null;
  const onRefresh = async () => { setRefreshing(true); try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateViatorPicksFromBackend(true), refreshRegional()]); } finally { setRefreshing(false); } };
  const seeAll = (category: HomeGuideCategory) => router.push(HOME_LEDGERS[category].href);
  return <Screen><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader title="Discover" />
    <CitySearchBar testID="discover-search" city={displayCity} onPress={() => router.push({ pathname: '/search', params: params.q ? { q: params.q } : {} })} />
    <HRow gap={6} bleed={false}>{modes.map(item => <CityChip key={item.key} testID={`discover-chip-${item.key}`} label={item.label} glyph={item.glyph} selected={mode === item.key} onPress={() => setMode(item.key)} />)}</HRow>
    {search ? <View style={{ gap: 10 }}><PerksHeading title={`Matches for “${params.q}”`} />{search.length ? search.slice(0, 30).map(entry => <LocalPerksCard key={entry.kind + ':' + entry.id} entry={entry} catalog={catalog} />) : <EmptyState compact title="Nothing here just yet" message="Try another place, artist or kind of evening." />}</View> : <>
      <LocalPerksBanners catalog={catalog} compact />
      {(mode === 'all' || mode === 'events') ? <View><PerksHeading title="On stage" />{events[0] ? <LocalPerksCard entry={events[0]} catalog={catalog} format="wide" /> : <EmptyState compact title="No current shows yet" message="Current listings appear here as the calendar updates." />}</View> : null}
      {(mode === 'all' || mode === 'events') && events.length > 1 ? <View><PerksHeading title="More on stage" action="See all" onPress={() => seeAll('events')} /><PerksRail entries={events.slice(1, 7)} catalog={catalog} /></View> : null}
      {(mode === 'all' || mode === 'eat') && tables.length ? <View><PerksHeading title="Find a good table" /><View style={{ gap: 10 }}>{tables.slice(0, 3).map(entry => <LocalPerksCard key={entry.kind + ':' + entry.id} entry={entry} catalog={catalog} />)}</View></View> : null}
      {(mode === 'all' || mode === 'eat') && tables.length > 3 ? <View><PerksHeading title="More good tables" action="See all" onPress={() => seeAll('eat')} /><PerksRail entries={tables.slice(3, 9)} catalog={catalog} /></View> : null}
      {(mode === 'all' || mode === 'bars') && bars.length ? <View><PerksHeading title="After dinner" action="See all" onPress={() => seeAll('bars')} /><PerksRail entries={bars.slice(0, 6)} catalog={catalog} /></View> : null}
      {(mode === 'all' || mode === 'routes') && routes.length ? <View><PerksHeading title="A little wandering" action="See all" onPress={() => seeAll('routes')} /><View style={{ gap: 10 }}>{routes.slice(0, 3).map(entry => <LocalPerksCard key={entry.kind + ':' + entry.id} entry={entry} catalog={catalog} />)}</View></View> : null}
      {(mode === 'all' || mode === 'venues') && rooms.length ? <View><PerksHeading title="Rooms worth knowing" /><PerksRail entries={rooms.slice(0, 6)} catalog={catalog} /></View> : null}
      {mode !== 'all' && !({ eat: tables, bars, routes, events, venues: rooms }[mode]?.length) ? <EmptyState compact title={`More of ${displayCity} is on the way`} message="Local listings appear as the catalog grows." /> : null}
    </>}
  </ScreenScroll></Screen>;
}
