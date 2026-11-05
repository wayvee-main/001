import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CitySearchBar } from '@/components/city-controls';
import { SectionRule } from '@/components/aurora';
import { DaybreakIntro, type DaybreakPeriod } from '@/components/daybreak';
import { QuietHomeFeature, QuietHomeGroup, QuietHomeHeading, QuietHomeLink, QuietHomeOffers, QuietHomePeriods, QuietHomeVee, QuietHomeVenueRow } from '@/components/quiet-home';
import { Screen, ScreenScroll } from '@/components/layout';
import { HomeTimelyRecommendations, LocalCategoryShelf, LocalPerksHeader } from '@/components/local-perks';
import { homeCollectionGlyph, homeDiscoveryIdeas } from '@/lib/home-discovery';
import { homeIndexPhotos } from '@/lib/home-index-photos';
import { HOME_LEDGERS } from '@/lib/home-ledger';
import { eventsLeadNow } from '@/lib/daypart';
import { perksEntries, perksFeaturedEntries } from '@/lib/local-perks';
import { hydrateEventsFromBackend } from '@/lib/events-remote';
import { hydratePlacesFromBackend } from '@/lib/places';
import { useScoper } from '@/lib/store';
import { useHomeGuide } from '@/lib/use-home-guide';
import { hydrateWeatherFromBackend } from '@/lib/weather';

export default function HomeScreen() {
  const router = useRouter(), { catalog, now, displayCity, refreshRegional } = useHomeGuide();
  const refreshLocation = useScoper(s => s.refreshLocation), [refreshing, setRefreshing] = useState(false);
  const [periodOverride, setPeriodOverride] = useState<DaybreakPeriod | null>(null);
  const period = periodOverride || (eventsLeadNow(now) ? 'evening' : 'day');
  const ideas = homeDiscoveryIdeas(now), tables = perksFeaturedEntries(catalog, 'eat'), bars = perksEntries(catalog, 'bars'), events = perksEntries(catalog, 'events');
  const table = tables.find(entry => homeIndexPhotos(entry, catalog).length && (entry.detailContent?.menu?.items.length || entry.detailContent?.menuDocuments?.length)) || tables.find(entry => homeIndexPhotos(entry, catalog).length) || tables[0];
  const feature = period === 'evening' ? events.find(entry => entry.image) || table || bars[0] : table || perksEntries(catalog, 'routes')[0];
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Promise.all([hydrateEventsFromBackend(true), hydratePlacesFromBackend(true), hydrateWeatherFromBackend(true), refreshLocation(), refreshRegional()]); }
    finally { setRefreshing(false); }
  };
  return <Screen aurora><ScreenScroll gap={18} clearsTabBar refreshing={refreshing} onRefresh={onRefresh}>
    <LocalPerksHeader location={false} />
    <DaybreakIntro city={displayCity} />
    <View style={{ gap: 6, marginBottom: -11 }}>
      <CitySearchBar variant="aurora" testID="home-search" labelTestID="home-search-label" city={displayCity} onPress={() => router.push('/search')} />
      <HomeTimelyRecommendations catalog={catalog} now={now} />
    </View>
    <LocalCategoryShelf catalog={catalog} />
    <View testID="quiet-home-feed" style={{ gap: 22 }}>
      <View style={{ gap: 16 }}>
        <SectionRule spacing={0} testID="home-period-rule" />
        <QuietHomePeriods value={period} onChange={setPeriodOverride} />
      </View>
      {feature ? <View><QuietHomeHeading title="Start here" />
        <QuietHomeFeature entry={feature} catalog={catalog} now={now} />
      </View> : null}
      <QuietHomeOffers />
      <View>
        {bars.length ? <><QuietHomeHeading title="For later" onMore={() => router.push(HOME_LEDGERS.bars.href)} />
          <QuietHomeGroup>{bars.slice(0, 2).map((entry, index) => <QuietHomeVenueRow key={entry.kind + ':' + entry.id} divider={index > 0} entry={entry} catalog={catalog} now={now} />)}</QuietHomeGroup>
        </> : null}
        <QuietHomeVee />
      </View>
      <View><QuietHomeHeading title="For you" onMore={() => router.push('/home/ideas')} />
        <QuietHomeGroup testID="quiet-home-ideas">{ideas.map((idea, index) => <QuietHomeLink key={idea.id} divider={index > 0} testID={`home-idea-${idea.id}`} title={idea.title} glyph={idea.glyph} accessibilityLabel={`${idea.title}. ${idea.detail}`} onPress={() => router.push(idea.href as never)} />)}</QuietHomeGroup>
      </View>
      {catalog.collections.length ? <View><QuietHomeHeading title="Collections" onMore={() => router.push('/home/collections')} />
        <QuietHomeGroup testID="quiet-home-collections">{catalog.collections.slice(0, 2).map((collection, index) => <QuietHomeLink key={collection.id} divider={index > 0} testID={`home-collection-${collection.id}`} title={collection.title} glyph={homeCollectionGlyph(collection.id)}
          accessibilityLabel={`${collection.title}. ${collection.items.length} picks. ${collection.subtitle}`}
          onPress={() => router.push(`/home/collection?id=${encodeURIComponent(collection.id)}` as never)} />)}</QuietHomeGroup>
      </View> : null}
    </View>
  </ScreenScroll></Screen>;
}
