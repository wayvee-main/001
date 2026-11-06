import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AuroraEntryRow, AuroraList } from '@/components/aurora';
import { CitySearchBar } from '@/components/city-controls';
import { CityDeskBrowse, CityDeskFamilyTabs, CityDeskFeature, CityDeskHeadline, CityDeskSection } from '@/components/city-desk';
import { categoryHref, DiscoverDealsRow, DiscoverMore, DiscoverRooms, DiscoverRows, DiscoverShows, leadCategory, useDiscoverShortcuts } from '@/components/discover';
import { Screen, ScreenScroll } from '@/components/layout';
import { LocalPerksHeader } from '@/components/local-perks';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { buildDiscoverGuide, countLabel, type DiscoverFamily, type DiscoverFamilyId } from '@/lib/discover-categories';
import { discoverDeals } from '@/lib/discover-deals';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { homeGuideKey, searchHomeGuide } from '@/lib/home-guide';
import { hydratePlacesFromBackend } from '@/lib/places';
import { promotionForPlacement } from '@/lib/promotions';
import { useThemeColors } from '@/lib/theme';
import { headingStyle } from '@/lib/typography';
import { useHomeGuide } from '@/lib/use-home-guide';
import { hydrateViatorPicksFromBackend } from '@/lib/viator';

const LEGACY_MODES: Record<string, string> = { Food: 'eat', eat: 'eat', Nightlife: 'drink', bars: 'drink', Events: 'shows', events: 'shows', Routes: 'wander', routes: 'wander', Venues: 'go-out', venues: 'go-out' };

export default function DiscoverScreen() {
  const { catalog, displayCity, refreshRegional } = useHomeGuide(), colors = useThemeColors(), now = useNow(), router = useRouter();
  const params = useLocalSearchParams<{ q?: string; mode?: string }>(), [refreshing, setRefreshing] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<DiscoverFamilyId>('eat');
  const guide = useMemo(() => buildDiscoverGuide(catalog), [catalog]);
  const deals = discoverDeals(catalog, now, [promotionForPlacement('home-food'), promotionForPlacement('ordering-savings'), promotionForPlacement('discover-rides')]);
  const shortcuts = useDiscoverShortcuts(guide), search = params.q?.trim() ? searchHomeGuide(catalog, params.q) : null;
  const families = guide.families.filter(family => family.count || family.id === 'go-out' && guide.series.length);
  const activeFamily = families.find(family => family.id === selectedFamily) || families[0];
  const legacy = params.mode ? LEGACY_MODES[params.mode] : undefined;
  useEffect(() => { if (legacy && guide.byId[legacy]) router.replace(categoryHref(legacy) as never); }, [guide.byId, legacy, router]);
  const onRefresh = async () => { setRefreshing(true); try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateViatorPicksFromBackend(true), refreshRegional()]); } finally { setRefreshing(false); } };

  const chapter = (family: DiscoverFamily) => {
    const lead = leadCategory(family), others = family.categories.filter(category => category.id !== lead?.id).sort((a, b) => b.entries.length - a.entries.length);
    const heading = <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <Text accessibilityRole="header" className="text-ink" style={headingStyle(29, true)}>{family.title}</Text>
      <Text className="font-dm" style={{ fontSize: 12, lineHeight: 17, color: colors['fg-muted'] }}>{countLabel(family.count, family.unit)}</Text>
    </View>;
    if (family.id === 'go-out') {
      const venues = family.categories.filter(category => category.id !== 'shows').flatMap(category => category.entries);
      const shows = guide.byId.shows?.entries || [], upcoming = shows.length + guide.series.length;
      const chips = [guide.byId['live-music'], ...others.filter(category => category.id !== 'shows')].filter(Boolean);
      return <View key={family.id} testID="discover-chapter-go-out" style={{ gap: 13 }}>
        {heading}
        {upcoming ? <CityDeskSection title="On stage" onMore={() => router.push(categoryHref('shows') as never)}>
          <DiscoverShows events={shows} series={guide.series} catalog={catalog} layout="stack" />
        </CityDeskSection> : null}
        {venues.length ? <View style={{ marginTop: 8 }}><CityDeskSection title="Rooms worth knowing" onMore={() => router.push(categoryHref('go-out') as never)}><DiscoverRooms venues={venues} catalog={catalog} /></CityDeskSection></View> : null}
        <DiscoverMore family={family.title} categories={chips} />
      </View>;
    }
    if (!lead?.entries.length) return null;
    const first = lead.entries[0];
    return <View key={family.id} testID={`discover-chapter-${family.id}`} style={{ gap: 12 }}>
      {heading}
      <CityDeskFeature entry={first} catalog={catalog} now={now} />
      <DiscoverRows compact entries={lead.entries.slice(1, 4)} catalog={catalog} now={now} meta={lead.meta} testID={`discover-${family.id}-row`} />
      <DiscoverMore family={family.title} categories={[lead, ...others]} />
    </View>;
  };

  return <Screen><ScreenScroll gap={20} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader appearance="citydesk" title="Discover" />
    <CityDeskHeadline accent="next good thing.">Find your</CityDeskHeadline>
    <CitySearchBar variant="citydesk" testID="discover-search" city={displayCity} onPress={() => router.push({ pathname: '/search', params: params.q ? { q: params.q } : {} })} />
    {search ? <CityDeskSection title={`Matches for “${params.q}”`}>
      {search.length ? <AuroraList>{search.slice(0, 30).map((entry, index) => <AuroraEntryRow key={homeGuideKey(entry.kind, entry.id)} testID="discover-row" divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList>
        : <EmptyState compact title="Nothing here just yet" message="Try another place, artist or kind of evening." />}
    </CityDeskSection> : <>
      {activeFamily ? <>
        <CityDeskFamilyTabs families={families} selected={activeFamily.id} onSelect={setSelectedFamily} />
        {chapter(activeFamily)}
      </> : <EmptyState compact title={`More of ${displayCity} is on the way`} message="Local listings appear as the catalog grows." />}
      {deals.length ? <CityDeskSection title="Deals & happy hours" onMore={() => router.push(categoryHref('deals') as never)}>
        <DiscoverDealsRow deals={deals} catalog={catalog} now={now} />
      </CityDeskSection> : null}
      {shortcuts.length ? <CityDeskSection title="Browse all" action={`All ${guide.all.length}`} onMore={() => router.push('/categories')}>
        <CityDeskBrowse categories={shortcuts} onSelect={id => router.push(categoryHref(id) as never)} />
      </CityDeskSection> : null}
    </>}
  </ScreenScroll></Screen>;
}
