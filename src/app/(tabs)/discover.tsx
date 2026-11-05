import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AuroraEntryRow, AuroraList, GradientText } from '@/components/aurora';
import { CitySearchBar } from '@/components/city-controls';
import { categoryHref, DiscoverBrowseGrid, DiscoverCategoryPoster, DiscoverChapter, DiscoverDealsRow, DiscoverMore, DiscoverRooms, DiscoverRows, DiscoverSectionHeading, DiscoverShows, leadCategory, useDiscoverShortcuts } from '@/components/discover';
import { Screen, ScreenScroll } from '@/components/layout';
import { LocalPerksHeader } from '@/components/local-perks';
import { NativePressable as Pressable } from '@/components/native-pressable';
import { EmptyState } from '@/components/ui';
import { useNow } from '@/lib/clock';
import { buildDiscoverGuide, type DiscoverFamily } from '@/lib/discover-categories';
import { discoverDeals } from '@/lib/discover-deals';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { homeGuideKey, searchHomeGuide } from '@/lib/home-guide';
import { hydratePlacesFromBackend } from '@/lib/places';
import { promotionForPlacement } from '@/lib/promotions';
import { useThemeColors } from '@/lib/theme';
import { useHomeGuide } from '@/lib/use-home-guide';
import { hydrateViatorPicksFromBackend } from '@/lib/viator';

/** Older links opened Discover pre-filtered; they now land on the matching category. */
const LEGACY_MODES: Record<string, string> = { Food: 'eat', eat: 'eat', Nightlife: 'drink', bars: 'drink', Events: 'shows', events: 'shows', Routes: 'wander', routes: 'wander', Venues: 'go-out', venues: 'go-out' };

export default function DiscoverScreen() {
  const { catalog, displayCity, refreshRegional } = useHomeGuide(), colors = useThemeColors(), now = useNow(), router = useRouter();
  const params = useLocalSearchParams<{ q?: string; mode?: string }>(), [refreshing, setRefreshing] = useState(false);
  const guide = useMemo(() => buildDiscoverGuide(catalog), [catalog]);
  const deals = discoverDeals(catalog, now, [promotionForPlacement('home-food'), promotionForPlacement('ordering-savings'), promotionForPlacement('discover-rides')]);
  const shortcuts = useDiscoverShortcuts(guide), search = params.q?.trim() ? searchHomeGuide(catalog, params.q) : null;
  const legacy = params.mode ? LEGACY_MODES[params.mode] : undefined;
  useEffect(() => { if (legacy && guide.byId[legacy]) router.replace(categoryHref(legacy) as never); }, [guide.byId, legacy, router]);
  const onRefresh = async () => { setRefreshing(true); try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateViatorPicksFromBackend(true), refreshRegional()]); } finally { setRefreshing(false); } };

  // One rhythm per family: lead poster, three rows, then the rest of the family as chips.
  const chapter = (family: DiscoverFamily) => {
    const lead = leadCategory(family);
    if (!lead) return null;
    const others = family.categories.filter(category => category.id !== lead.id).sort((a, b) => b.entries.length - a.entries.length);
    if (family.id === 'go-out') {
      const venues = family.categories.filter(category => category.id !== 'shows').flatMap(category => category.entries);
      const shows = guide.byId.shows?.entries || [], upcoming = shows.length + guide.series.length;
      const chips = [guide.byId['live-music'], ...others.filter(category => category.id !== 'shows')].filter(Boolean);
      return <DiscoverChapter key={family.id} family={family} label="Shows & rooms">
        {upcoming ? <DiscoverSectionHeading title="On stage" meta={`${upcoming} upcoming`} action="See all" onPress={() => router.push(categoryHref('shows') as never)} /> : null}
        <DiscoverShows events={shows} series={guide.series} catalog={catalog} />
        {venues.length ? <View style={{ marginTop: upcoming ? 24 : 0 }}><DiscoverSectionHeading title="Rooms worth knowing" meta={`${venues.length} venues`} action="See all" onPress={() => router.push(categoryHref('go-out') as never)} /><DiscoverRooms venues={venues} catalog={catalog} /></View> : null}
        <DiscoverMore family={family.title} categories={chips} />
      </DiscoverChapter>;
    }
    return <DiscoverChapter key={family.id} family={family}>
      <DiscoverCategoryPoster category={lead} catalog={catalog} kicker={family.title} />
      <View style={{ height: 10 }} />
      <DiscoverRows entries={lead.entries.slice(0, 3)} catalog={catalog} now={now} meta={lead.meta} testID={`discover-${family.id}-row`} />
      <DiscoverMore family={family.title} categories={others} />
    </DiscoverChapter>;
  };

  return <Screen aurora><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader title="Discover" />
    <Text accessibilityRole="header" className="font-dm-bold text-ink" style={{ fontSize: 30, lineHeight: 35, letterSpacing: -1 }}>A little more <GradientText text="out there." /></Text>
    <CitySearchBar variant="aurora" testID="discover-search" city={displayCity} onPress={() => router.push({ pathname: '/search', params: params.q ? { q: params.q } : {} })} />
    {search ? <View style={{ gap: 12 }}>
      <DiscoverSectionHeading title={`Matches for “${params.q}”`} meta={`${search.length} ${search.length === 1 ? 'option' : 'options'} to explore`} />
      {search.length ? <AuroraList>{search.slice(0, 30).map((entry, index) => <AuroraEntryRow key={homeGuideKey(entry.kind, entry.id)} testID="discover-row" divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</AuroraList>
        : <EmptyState compact title="Nothing here just yet" message="Try another place, artist or kind of evening." />}
    </View> : <>
      {shortcuts.length ? <View style={{ marginTop: 6 }}>
        <DiscoverSectionHeading title="Browse" meta={`${guide.all.length} categories`} />
        <DiscoverBrowseGrid categories={shortcuts} catalog={catalog} />
        <Pressable testID="discover-all-categories" accessibilityRole="button" accessibilityLabel={`All ${guide.all.length} categories`} onPress={() => router.push('/categories')}
          style={({ pressed }) => ({ minHeight: 44, marginTop: 10, borderRadius: 22, borderWidth: 1, borderColor: colors['control-edge'], backgroundColor: colors['surface-raised'], alignItems: 'center', justifyContent: 'center', opacity: pressed ? .75 : 1 })}>
          <Text className="font-dm-medium" style={{ fontSize: 14, lineHeight: 19, color: colors['fg-accent'] }}>{`All ${guide.all.length} categories ›`}</Text>
        </Pressable>
      </View> : null}
      {deals.length ? <View style={{ marginTop: 10 }}>
        <DiscoverSectionHeading title="Deals & happy hours" meta={`${deals.length} near you`} action="See all" onPress={() => router.push(categoryHref('deals') as never)} />
        <DiscoverDealsRow deals={deals} catalog={catalog} now={now} />
      </View> : null}
      {guide.families.some(family => family.count) ? guide.families.map(chapter)
        : <EmptyState compact title={`More of ${displayCity} is on the way`} message="Local listings appear as the catalog grows." />}
    </>}
  </ScreenScroll></Screen>;
}
